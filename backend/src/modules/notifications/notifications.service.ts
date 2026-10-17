import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createDecipheriv } from 'node:crypto';
import { PrismaService } from '../../prisma.service';

const OFFSET_TYPES = ['calendar_days', 'business_days'];
const EVENT_TYPES = ['closureDate', 'demolitionDate', 'installationDate', 'techOpenDate'];
const CHANNELS = ['intradesk', 'telegram', 'pachca'];

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}


  private decryptApiKey(ciphertext: string): string {
    const raw = process.env.LDAP_ENCRYPTION_KEY || '';
    const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('Не настроен ключ шифрования интеграции');
    const [iv, tag, encrypted] = ciphertext.split(':');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
  }

  private addDays(date: Date, days: number) {
    const result = new Date(date);
    result.setHours(0, 0, 0, 0);
    let remaining = days;
    while (remaining > 0) {
      result.setDate(result.getDate() - 1);
      if (result.getDay() !== 0 && result.getDay() !== 6) remaining--;
    }
    return result;
  }

  private renderTemplate(template: string, project: any) {
    const values: Record<string, string> = {
      shopNumber: String(project.shop?.shopNumber || project.storeNumber || ''),
      address: String(project.shop?.address || ''),
      tu_fio: String(project.tu?.fullName || ''),
      tu_phone: String(project.tu?.phone || ''),
    };
    for (const key of EVENT_TYPES) {
      const value = project[key];
      values[key] = value ? new Date(value).toLocaleDateString('ru-RU') : '';
    }
    return template.replace(/\{([A-Za-z]+)\}/g, (token, key) => key in values ? values[key] : token);
  }

  private async runDueNotifications() {
    if (this.checking) return;
    this.checking = true;
    try {
      const rules = await this.prisma.notificationRule.findMany({ where: { enabled: true, channel: 'intradesk' } });
      if (!rules.length) return;
      const integration = await this.prisma.ldapSettings.findUnique({ where: { id: 'default' } });
      if (!integration?.intraDeskEnabled || !integration.intraDeskApiGateway || !integration.intraDeskApiKeyEncrypted) return;
      const now = new Date();
      const time = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      const projects = await this.prisma.storeProject.findMany({
        where: { isDeleted: false },
        include: { shop: true, tu: true },
      });
      for (const rule of rules) {
        if (rule.sendTime !== time) continue;
        for (const project of projects) {
          const rawEventDate = (project as any)[rule.eventType];
          if (!rawEventDate) continue;
          const eventDate = new Date(rawEventDate);
          const dueDate = new Date(eventDate);
          dueDate.setHours(0, 0, 0, 0);
          if (rule.offsetType === 'business_days') {
            const remaining = rule.days;
            let count = remaining;
            while (count > 0) {
              dueDate.setDate(dueDate.getDate() - 1);
              if (dueDate.getDay() !== 0 && dueDate.getDay() !== 6) count--;
            }
          } else {
            dueDate.setDate(dueDate.getDate() - rule.days);
          }
          if (dueDate.getFullYear() !== now.getFullYear() || dueDate.getMonth() !== now.getMonth() || dueDate.getDate() !== now.getDate()) continue;
          const unique = { ruleId_projectId_eventDate: { ruleId: rule.id, projectId: project.id, eventDate: new Date(eventDate.getFullYear(), eventDate.getMonth(), eventDate.getDate()) } };
          const existing = await this.prisma.notificationDelivery.findUnique({ where: unique });
          if (existing?.status === 'sent') continue;
          try {
            const delivery = existing || await this.prisma.notificationDelivery.create({ data: { ruleId: rule.id, projectId: project.id, eventDate: unique.ruleId_projectId_eventDate.eventDate, status: 'sending' } });
            const message = this.renderTemplate(rule.messageTemplate, project);
            const apiKey = this.decryptApiKey(integration.intraDeskApiKeyEncrypted);
            const response = await fetch(integration.intraDeskApiGateway, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
              body: JSON.stringify({ group: rule.intradeskGroup, service: rule.intradeskService, subject: rule.intradeskSubject, description: message, shopNumber: project.shop?.shopNumber || project.storeNumber }),
            });
            if (!response.ok) throw new Error(`IntraDesk вернул HTTP ${response.status}: ${(await response.text()).slice(0, 500)}`);
            await this.prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'sent', message, sentAt: new Date() } });
          } catch (error: any) {
            this.logger.error(`Не удалось отправить уведомление "${rule.name}" для объекта ${project.id}: ${error?.message || error}`);
            try {
              await this.prisma.notificationDelivery.upsert({
                where: unique,
                create: { ruleId: rule.id, projectId: project.id, eventDate: unique.ruleId_projectId_eventDate.eventDate, status: 'error', message: String(error?.message || error).slice(0, 3000) },
                update: { status: 'error', message: String(error?.message || error).slice(0, 3000), sentAt: new Date() },
              });
            } catch (persistError: any) { this.logger.error(`Не удалось сохранить статус отправки: ${persistError?.message || persistError}`); }
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`Ошибка планировщика уведомлений: ${error?.message || error}`);
    } finally { this.checking = false; }
  }
\n  findAll() {
    return this.prisma.notificationRule.findMany({ orderBy: { createdAt: 'asc' } });
  }

  private validate(input: any, partial = false) {
    const data: any = {};
    const fields = ['name', 'offsetType', 'eventType', 'days', 'channel', 'enabled', 'sendTime', 'messageTemplate', 'intradeskGroup', 'intradeskService', 'intradeskSubject'];
    for (const field of fields) if (input[field] !== undefined) data[field] = input[field];
    if (!partial || data.name !== undefined) {
      if (typeof data.name !== 'string' || !data.name.trim() || data.name.trim().length > 120) throw new BadRequestException('Название уведомления обязательно (до 120 символов)');
      data.name = data.name.trim();
    }
    if (!partial || data.offsetType !== undefined) if (!OFFSET_TYPES.includes(data.offsetType)) throw new BadRequestException('Выберите тип отсчёта дней');
    if (!partial || data.eventType !== undefined) if (!EVENT_TYPES.includes(data.eventType)) throw new BadRequestException('Выберите событие');
    if (!partial || data.days !== undefined) if (!Number.isInteger(data.days) || data.days < 0 || data.days > 365) throw new BadRequestException('Количество дней должно быть от 0 до 365');
    if (!partial || data.channel !== undefined) if (!CHANNELS.includes(data.channel)) throw new BadRequestException('Выберите канал связи');
    if (!partial || data.enabled !== undefined) if (typeof data.enabled !== 'boolean') throw new BadRequestException('Укажите состояние уведомления');
    if (!partial || data.sendTime !== undefined) if (typeof data.sendTime !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(data.sendTime)) throw new BadRequestException('Время должно быть в формате ЧЧ:ММ');
    if (!partial || data.messageTemplate !== undefined) {
      if (typeof data.messageTemplate !== 'string' || !data.messageTemplate.trim() || data.messageTemplate.length > 10000) throw new BadRequestException('Текст уведомления обязателен (до 10000 символов)');
      data.messageTemplate = data.messageTemplate.trim();
    }
    for (const field of ['intradeskGroup', 'intradeskService', 'intradeskSubject']) {
      if (data[field] !== undefined && (typeof data[field] !== 'string' || data[field].length > 500)) throw new BadRequestException('Поля IntraDesk не должны превышать 500 символов');
    }
    const channel = data.channel;
    if (channel === 'intradesk' && !partial) {
      for (const field of ['intradeskGroup', 'intradeskService', 'intradeskSubject']) {
        if (typeof data[field] !== 'string' || !data[field].trim()) throw new BadRequestException('Для IntraDesk заполните группу исполнителей, сервис и тему заявки');
        data[field] = data[field].trim();
      }
    }
    return data;
  }

  async create(input: any) {
    const data = this.validate(input);
    if (data.channel !== 'intradesk') throw new BadRequestException('Каналы Telegram и Pachca пока недоступны');
    const integration = await this.prisma.ldapSettings.findUnique({ where: { id: 'default' } });
    if (!integration?.intraDeskEnabled) throw new BadRequestException('Сначала подключите интеграцию IntraDesk');
    return this.prisma.notificationRule.create({ data });
  }

  async update(id: string, input: any) {
    const existing = await this.prisma.notificationRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Уведомление не найдено');
    const data = this.validate(input, true);
    const channel = data.channel ?? existing.channel;
    if (channel !== 'intradesk') throw new BadRequestException('Каналы Telegram и Pachca пока недоступны');
    if (channel === 'intradesk') {
      for (const field of ['intradeskGroup', 'intradeskService', 'intradeskSubject']) {
        const value = data[field] ?? (existing as any)[field];
        if (typeof value !== 'string' || !value.trim()) throw new BadRequestException('Для IntraDesk заполните группу исполнителей, сервис и тему заявки');
      }
    }
    return this.prisma.notificationRule.update({ where: { id }, data });
  }

  async remove(id: string) {
    const existing = await this.prisma.notificationRule.findUnique({ where: { id }, select: { id: true } });
    if (!existing) throw new NotFoundException('Уведомление не найдено');
    await this.prisma.notificationRule.delete({ where: { id } });
    return { success: true };
  }
}
