import { BadRequestException, Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { ShopsService } from '../shops/shops.service';

const SHOP_TASK_ID = 'shops-sync';

@Injectable()
export class SchedulerService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SchedulerService.name);
  private timer?: NodeJS.Timeout;
  private running = false;
  private lastCheckedMinute = '';

  constructor(private readonly prisma: PrismaService, private readonly shops: ShopsService) {}

  async onModuleInit() {
    await this.ensureTask();
    this.timer = setInterval(() => void this.tick(), 30000);
    void this.tick();
  }

  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }

  async getTasks() {
    await this.ensureTask();
    return this.prisma.schedulerTask.findMany({ orderBy: { name: 'asc' } });
  }

  private ensureTask() {
    return this.prisma.schedulerTask.upsert({
      where: { id: SHOP_TASK_ID },
      create: { id: SHOP_TASK_ID, name: 'Синхронизация справочника магазинов', cronExpression: '0 0 * * *', enabled: true },
      update: {},
    });
  }

  async updateTask(id: string, input: { enabled?: boolean; cronExpression?: string }) {
    if (id !== SHOP_TASK_ID) throw new BadRequestException('Неизвестная задача планировщика');
    const current = await this.ensureTask();
    const data: any = {};
    if (input.enabled !== undefined) data.enabled = input.enabled;
    if (input.cronExpression !== undefined) {
      const expression = input.cronExpression.trim();
      if (expression.length > 100 || !this.validCron(expression)) throw new BadRequestException('Укажите корректное crontab-выражение из пяти полей, например 0 0 * * *');
      data.cronExpression = expression;
    }
    return this.prisma.schedulerTask.update({ where: { id: current.id }, data });
  }

  async runTask(id: string, actor?: { id: string; name: string }) {
    if (id !== SHOP_TASK_ID) throw new BadRequestException('Неизвестная задача планировщика');
    if (this.running) throw new BadRequestException('Задача уже выполняется');
    this.running = true;
    await this.ensureTask();
    await this.prisma.schedulerTask.update({ where: { id }, data: { lastRunAt: new Date(), lastStatus: 'running', lastMessage: 'Синхронизация выполняется' } });
    try {
      const result = await this.shops.syncShops(actor);
      await this.prisma.schedulerTask.update({ where: { id }, data: { lastStatus: 'success', lastMessage: `Получено: ${result.sourceCount}; добавлено: ${result.created}; обновлено: ${result.updated}; без изменений: ${result.unchanged}` } });
      return { ...result, taskId: id };
    } catch (error: any) {
      const message = String(error?.message || 'Неизвестная ошибка').slice(0, 1000);
      await this.prisma.schedulerTask.update({ where: { id }, data: { lastStatus: 'error', lastMessage: message } });
      throw error;
    } finally {
      this.running = false;
    }
  }

  private async tick() {
    const now = new Date();
    const minuteKey = `${now.getFullYear()}-${now.getMonth()}-${now.getDate()}-${now.getHours()}-${now.getMinutes()}`;
    if (minuteKey === this.lastCheckedMinute) return;
    this.lastCheckedMinute = minuteKey;
    try {
      const task = await this.ensureTask();
      if (!task.enabled || !this.cronMatches(task.cronExpression, now)) return;
      if (task.lastRunAt && task.lastRunAt.getFullYear() === now.getFullYear() && task.lastRunAt.getMonth() === now.getMonth() && task.lastRunAt.getDate() === now.getDate() && task.lastRunAt.getHours() === now.getHours() && task.lastRunAt.getMinutes() === now.getMinutes()) return;
      await this.runTask(task.id);
    } catch (error: any) {
      this.logger.error(`Scheduled shops sync failed: ${error?.message || error}`);
    }
  }

  private validCron(expression: string) {
    const fields = expression.split(/\s+/);
    if (fields.length !== 5) return false;
    const ranges = [[0, 59], [0, 23], [1, 31], [1, 12], [0, 7]];
    return fields.every((field, index) => field.split(',').every(part => {
      const match = part.match(/^(\*|\d+|\d+-\d+)(?:\/(\d+))?$/);
      if (!match) return false;
      if (match[2] && Number(match[2]) < 1) return false;
      if (match[1] === '*') return true;
      const nums = match[1].split('-').map(Number);
      return nums.every(n => n >= ranges[index][0] && n <= ranges[index][1]) && (nums.length === 1 || nums[0] <= nums[1]);
    }));
  }

  private cronMatches(expression: string, date: Date) {
    if (!this.validCron(expression)) return false;
    const values = [date.getMinutes(), date.getHours(), date.getDate(), date.getMonth() + 1, date.getDay()];
    return expression.split(/\s+/).every((field, index) => field.split(',').some(part => {
      const [base, stepText] = part.split('/');
      const step = stepText ? Number(stepText) : 1;
      const [min, max] = base === '*' ? [0, 999] : base.includes('-') ? base.split('-').map(Number) : [Number(base), Number(base)];
      return values[index] >= min && values[index] <= max && (values[index] - min) % step === 0;
    }));
  }
}
