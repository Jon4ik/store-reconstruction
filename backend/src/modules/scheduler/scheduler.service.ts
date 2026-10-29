import {backupName} from './backup-name';
import {DatabaseBackupService} from './database-backup.service';
import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ShopsService } from '../shops/shops.service';

const SHOP_TASK_ID = 'shops-sync';
const BACKUP_TASK_ID = 'postgresql-export';
const SCHEDULER_INTERVAL_MS = 10_000;
const SCHEDULER_TIMEZONE = process.env.SCHEDULER_TIMEZONE || 'Europe/Moscow';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer?: NodeJS.Timeout;
  private running = new Set<string>();
  private checking = false;

  constructor(private readonly prisma: PrismaService, private readonly shops: ShopsService, private readonly backups: DatabaseBackupService) {}

  async onModuleInit() {
    this.logger.log(`Scheduler started; schedule timezone=${SCHEDULER_TIMEZONE}; server timezone=${Intl.DateTimeFormat().resolvedOptions().timeZone || 'system'}; polling every ${SCHEDULER_INTERVAL_MS / 1000}s`);
    // Start polling even if PostgreSQL is temporarily unavailable; task creation and
    // scheduled execution are retried on subsequent ticks, but never outside cron time.
    this.timer = setInterval(() => void this.tick(), SCHEDULER_INTERVAL_MS);
    void this.tick();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async getTasks() {
    await this.ensureTask();
    const tasks=await this.prisma.schedulerTask.findMany({ orderBy: { name: 'asc' } });return tasks.map(task=>({...task,...(task.id===BACKUP_TASK_ID?{passwordConfigured:(process.env.DB_BACKUP_PASSWORD||'').length>=12}:{})}));
  }

  private async ensureTask() {
    await this.prisma.schedulerTask.upsert({ where:{id:BACKUP_TASK_ID},create:{id:BACKUP_TASK_ID,name:'Экспорт PostgreSQL',cronExpression:'0 2 * * *',enabled:false,exportDirectory:'/db_logs'},update:{} });
    return this.prisma.schedulerTask.upsert({
      where: { id: SHOP_TASK_ID },
      create: { id: SHOP_TASK_ID, name: 'Синхронизация справочника магазинов', cronExpression: '0 0 * * *', enabled: true },
      update: {},
    });
  }

  async updateTask(id: string, input: { enabled?: boolean; cronExpression?: string; exportDirectory?:string; backupFileName?:string }) {
    if (![SHOP_TASK_ID,BACKUP_TASK_ID].includes(id)) throw new BadRequestException('Неизвестная задача планировщика');
    await this.ensureTask();
    const current = await this.prisma.schedulerTask.findUniqueOrThrow({where:{id}});
    const data: { enabled?: boolean; cronExpression?: string; exportDirectory?:string; backupFileName?:string } = {};
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if(input.backupFileName!==undefined){if(id!==BACKUP_TASK_ID)throw new BadRequestException('Имя файла доступно только для экспорта');backupName(input.backupFileName);data.backupFileName=input.backupFileName.trim().replace(/\.(zip|sql)$/i,'');}
    if(input.exportDirectory!==undefined){if(id!==BACKUP_TASK_ID||typeof input.exportDirectory!=='string'||!input.exportDirectory.startsWith('/')||input.exportDirectory.includes('\0')||input.exportDirectory.length>500)throw new BadRequestException('Укажите абсолютную папку экспорта');data.exportDirectory=input.exportDirectory.trim();}
    if (input.cronExpression !== undefined) {
      if(typeof input.cronExpression!=='string')throw new BadRequestException('Проверьте cron-выражение');
      const expression = input.cronExpression.trim();
      if (expression.length > 100 || !this.validCron(expression)) {
        throw new BadRequestException('Укажите корректное crontab-выражение из пяти полей, например */5 * * * *');
      }
      data.cronExpression = expression;
    }
    return this.prisma.schedulerTask.update({ where: { id: current.id }, data });
  }

  startTask(id:string,actor?:{id:string;name:string}){if(![SHOP_TASK_ID,BACKUP_TASK_ID].includes(id))throw new BadRequestException('Неизвестная задача');if(this.running.has(id))throw new BadRequestException('Задача уже выполняется');void this.runTask(id,actor).catch(error=>this.logger.error('Task failed: '+error.message));return {taskId:id,status:'running',message:'Экспорт запущен. Результат появится в планировщике.'};}

  async runTask(id: string, actor?: { id: string; name: string }) {
    if (![SHOP_TASK_ID,BACKUP_TASK_ID].includes(id)) throw new BadRequestException('Неизвестная задача планировщика');
    if (this.running.has(id)) throw new BadRequestException('Задача уже выполняется');

    this.running.add(id);
    try {
      await this.ensureTask();
      await this.prisma.schedulerTask.update({
        where: { id },
        data: { lastRunAt: new Date(), lastStatus: 'running', lastMessage: 'Задача выполняется' },
      });
      this.logger.log(`Starting scheduled task ${id}`);

      const task = await this.prisma.schedulerTask.findUniqueOrThrow({where:{id}});
      const result:any = id===BACKUP_TASK_ID ? await this.backups.export(task.exportDirectory,task.backupFileName) : await this.shops.syncShops(actor);
      const message = id===BACKUP_TASK_ID ? result.message : `Получено: ${result.sourceCount}; добавлено: ${result.created}; обновлено: ${result.updated}; без изменений: ${result.unchanged}`;
      await this.prisma.schedulerTask.update({
        where: { id },
        data: { lastStatus: 'success', lastMessage: message },
      });
      await this.writeTaskAudit(actor, 'success', message,id);
      this.logger.log(`Scheduled task ${id} completed: ${message}`);
      return { ...result, taskId: id };
    } catch (error: any) {
      const message = String(error?.message || 'Неизвестная ошибка').slice(0, 1000);
      this.logger.error(`Scheduled task ${id} failed: ${message}`);
      try {
        await this.prisma.schedulerTask.update({
          where: { id },
          data: { lastRunAt: new Date(), lastStatus: 'error', lastMessage: message },
        });
      } catch (statusError: any) {
        this.logger.error(`Could not persist failure status for ${id}: ${statusError?.message || statusError}`);
      }
      await this.writeTaskAudit(actor, 'error', message,id);
      throw error;
    } finally {
      this.running.delete(id);
    }
  }

  private async writeTaskAudit(actor: { id: string; name: string } | undefined, status: 'success' | 'error', message: string,id=SHOP_TASK_ID) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: actor?.id ?? null,
          action: 'scheduler_run',
          field: id,
          oldValue: '',
          newValue: status,
          details: JSON.stringify({outcome:status,message:message.slice(0,2500),taskId:id}),
        },
      });
    } catch (error: any) {
      this.logger.error(`Could not write scheduler audit record: ${error?.message || error}`);
    }
  }

  private async tick() {
    if (this.checking) return;
    this.checking = true;
    try {
      await this.ensureTask();
      const tasks=await this.prisma.schedulerTask.findMany({where:{enabled:true}});
      const now = new Date();
      for(const task of tasks){
        if(![SHOP_TASK_ID,BACKUP_TASK_ID].includes(task.id)||this.running.has(task.id))continue;
        if(!this.cronMatches(task.cronExpression,now))continue;
        if(task.lastRunAt&&this.sameScheduleMinute(task.lastRunAt,now))continue;
        void this.runTask(task.id).catch(error=>this.logger.error('Scheduled task failed: '+error.message));
      }
    } catch (error: any) {
      this.logger.error(`Scheduler poll failed: ${error?.message || error}`);
    } finally {
      this.checking = false;
    }
  }

  private validCron(expression: string) {
    const fields = expression.split(/\s+/);
    if (fields.length !== 5) return false;
    const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
    return fields.every((field, index) => field.split(',').every(part => {
      const match = part.match(/^(\*|\d+|\d+-\d+)(?:\/(\d+))?$/);
      if (!match || (match[2] && Number(match[2]) < 1)) return false;
      if (match[1] === '*') return true;
      const nums = match[1].split('-').map(Number);
      return nums.every(n => n >= ranges[index][0] && n <= ranges[index][1]) &&
        (nums.length === 1 || nums[0] <= nums[1]);
    }));
  }

  private fieldMatches(field: string, value: number, min: number, max: number) {
    return field.split(',').some(part => {
      const [base, stepText] = part.split('/');
      const step = stepText ? Number(stepText) : 1;
      const [start, end] = base === '*'
        ? [min, max]
        : base.includes('-')
          ? base.split('-').map(Number)
          : [Number(base), Number(base)];
      return value >= start && value <= end && (value - start) % step === 0;
    });
  }

  private scheduleParts(date: Date) {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: SCHEDULER_TIMEZONE,
      year: 'numeric', month: 'numeric', day: 'numeric',
      hour: 'numeric', minute: 'numeric', hourCycle: 'h23', weekday: 'short',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    const weekdays: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      year: Number(values.year), month: Number(values.month), day: Number(values.day),
      hour: Number(values.hour), minute: Number(values.minute), weekday: weekdays[values.weekday],
    };
  }

  private formatScheduleDate(date: Date) {
    return new Intl.DateTimeFormat('ru-RU', {
      timeZone: SCHEDULER_TIMEZONE, dateStyle: 'short', timeStyle: 'medium',
    }).format(date);
  }

  private sameScheduleMinute(left: Date, right: Date) {
    const a = this.scheduleParts(left), b = this.scheduleParts(right);
    return a.year === b.year && a.month === b.month && a.day === b.day && a.hour === b.hour && a.minute === b.minute;
  }

  private cronMatches(expression: string, date: Date) {
    if (!this.validCron(expression)) return false;
    const fields = expression.split(/\s+/);
    const local = this.scheduleParts(date);
    const minute = this.fieldMatches(fields[0], local.minute, 0, 59);
    const hour = this.fieldMatches(fields[1], local.hour, 0, 23);
    const dayOfMonth = this.fieldMatches(fields[2], local.day, 1, 31);
    const month = this.fieldMatches(fields[3], local.month, 1, 12);
    const weekdayField = fields[4].replace(/(^|,)7(?=,|$)/g, (_match, prefix) => prefix + '0');
    const dayOfWeek = this.fieldMatches(weekdayField, local.weekday, 0, 6);

    // Standard cron treats day-of-month and day-of-week as OR when both are restricted.
    const dayOfMonthRestricted = fields[2] !== '*';
    const dayOfWeekRestricted = fields[4] !== '*';
    const dayMatches = dayOfMonthRestricted && dayOfWeekRestricted
      ? dayOfMonth || dayOfWeek
      : dayOfMonth && dayOfWeek;

    return minute && hour && month && dayMatches;
  }
}
