import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

const OFFSET_TYPES = ['calendar_days', 'business_days'];
const EVENT_TYPES = ['closureDate', 'demolitionDate', 'installationDate', 'techOpenDate'];
const CHANNELS = ['intradesk', 'telegram', 'pachca'];

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  findAll() {
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
