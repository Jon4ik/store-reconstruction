import { BadRequestException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { createDecipheriv } from 'node:crypto';
import { PrismaService } from '../../prisma.service';

const OFFSET_TYPES = ['calendar_days', 'business_days'];
const EVENT_TYPES = ['closureDate', 'demolitionDate', 'installationDate', 'techOpenDate'];
const CHANNELS = ['intradesk', 'pachca', 'smtp'];

@Injectable()
export class NotificationsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(NotificationsService.name);
  private checking = false;
  private timer?: NodeJS.Timeout;
  constructor(private readonly prisma: PrismaService) {}

  onModuleInit() { this.logger.log('Планировщик уведомлений запущен; проверка каждые 10 секунд, часовой пояс Europe/Moscow'); this.timer = setInterval(() => void this.runDueNotifications(), 10_000); }
  onModuleDestroy() { if (this.timer) clearInterval(this.timer); }


  private decryptApiKey(ciphertext: string): string {
    const raw = process.env.LDAP_ENCRYPTION_KEY || '';
    const key = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (key.length !== 32) throw new Error('Не настроен ключ шифрования интеграции');
    const parts = ciphertext.split(':');
    const [iv, tag, encrypted] = parts;
    if (!iv || !tag || !encrypted) throw new Error('Сохранённый API-ключ IntraDesk повреждён');
    const decipher = createDecipheriv('aes-256-gcm', key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(encrypted, 'hex')), decipher.final()]).toString('utf8');
  }

  private getMoscowDateTime(date: Date) {
    const parts = new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Europe/Moscow',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', hourCycle: 'h23',
    }).formatToParts(date);
    const values = Object.fromEntries(parts.map(part => [part.type, part.value]));
    return {
      dateKey: `${values.year}-${values.month}-${values.day}`,
      time: `${values.hour}:${values.minute}`,
    };
  }

  private subtractDateDays(dateKey: string, days: number, businessDays: boolean): string {
    const [year, month, day] = dateKey.split('-').map(Number);
    const result = new Date(Date.UTC(year, month - 1, day));
    let remaining = days;
    while (remaining > 0) {
      result.setUTCDate(result.getUTCDate() - 1);
      const weekday = result.getUTCDay();
      if (!businessDays || (weekday !== 0 && weekday !== 6)) remaining--;
    }
    return `${result.getUTCFullYear()}-${String(result.getUTCMonth() + 1).padStart(2, '0')}-${String(result.getUTCDate()).padStart(2, '0')}`;
  }

  private renderTemplate(template: string, project: any, days?: number) {
    const pluralDays = (value: number) => { const n = Math.abs(value) % 100; const last = n % 10; return n > 10 && n < 20 ? 'дней' : last > 1 && last < 5 ? 'дня' : last === 1 ? 'день' : 'дней'; };
    const values: Record<string, string> = {
      shopNumber: String(project.shop?.shopNumber || project.storeNumber || ''),
      address: String(project.shop?.address || ''),
      tuFio: String(project.tu?.fullName || ''),
      tuPhone: String(project.tu?.phone || ''),
      days: days === undefined ? '' : String(days),
      daysText: days === undefined ? '' : `${days} ${pluralDays(days)}`,
    };
    for (const key of EVENT_TYPES) {
      const value = project[key];
      values[key] = value ? new Date(value).toLocaleDateString('ru-RU', { timeZone: 'Europe/Moscow' }) : '';
    }
    return template.replace(/\{([A-Za-z_]+)\}/g, (token, key) => key in values ? values[key] : token);
  }

  private async auditDelivery(input: { ruleId: string; ruleName: string; projectId: string; shopNumber: string; eventType: string; eventDate: Date; outcome: 'success' | 'error'; message: string; statusCode?: number }) {
    try {
      await this.prisma.auditLog.create({
        data: {
          userId: null, userName: 'Система', action: 'notification_delivery', field: input.eventType, oldValue: '', newValue: input.outcome,
          details: JSON.stringify({ outcome: input.outcome, ruleId: input.ruleId, ruleName: input.ruleName, projectId: input.projectId, shopNumber: input.shopNumber, eventType: input.eventType, eventDate: input.eventDate.toISOString(), statusCode: input.statusCode, message: input.message.slice(0, 2000) }).slice(0, 4000),
        },
      });
    } catch (error: any) {
      this.logger.error('Не удалось записать аудит уведомления «' + input.ruleName + '»: ' + (error?.message || error));
    }
  }

  private async runDueNotifications() {
    if (this.checking) return;
    this.checking = true;
    try {
      const rules = await this.prisma.notificationRule.findMany({ where: { enabled: true, channel: { in: CHANNELS } } });
      if (!rules.length) return;
      const integrations = await this.prisma.integrationSettings.findUnique({ where: { id: 'default' } });
      if (!integrations) return;
      const nowMoscow = this.getMoscowDateTime(new Date());
      const projects = await this.prisma.storeProject.findMany({ where: { isDeleted: false }, include: { shop: true, tu: true } });
      for (const rule of rules) {
        if (rule.sendTime !== nowMoscow.time) continue;
        const enabled = rule.channel === 'intradesk' ? integrations.intraDeskEnabled : rule.channel === 'pachca' ? integrations.pachcaEnabled : integrations.smtpEnabled;
        if (!enabled) {
          this.logger.warn(`Пропуск уведомления «${rule.name}»: интеграция ${rule.channel} выключена`);
          continue;
        }
        for (const project of projects) {
          const rawEventDate = (project as any)[rule.eventType];
          if (!rawEventDate) continue;
          const eventDateKey = this.getMoscowDateTime(new Date(rawEventDate)).dateKey;
          const eventDate = new Date(`${eventDateKey}T00:00:00.000Z`);
          const dueDateKey = this.subtractDateDays(eventDateKey, rule.days, rule.offsetType === 'business_days');
          if (dueDateKey !== nowMoscow.dateKey) continue;
          const unique = { ruleId_projectId_eventDate: { ruleId: rule.id, projectId: project.id, eventDate } };
          const existing = await this.prisma.notificationDelivery.findUnique({ where: unique });
          if (String(existing?.status || '').toLowerCase() === 'sent') continue;
          let delivery: any;
          const shopNumber = String(project.shop?.shopNumber || project.storeNumber || '');
          const message = this.renderTemplate(rule.messageTemplate, project, rule.days);
          let requestNumber = '';
          try {
            delivery = existing || await this.prisma.notificationDelivery.create({ data: { ruleId: rule.id, projectId: project.id, eventDate, status: 'sending' } });
            this.logger.log(`Отправка уведомления: ruleId=${rule.id}, rule="${rule.name}", channel=${rule.channel}, projectId=${project.id}, shop=${shopNumber}, eventDate=${eventDate.toISOString()}`);
            if (rule.channel === 'intradesk') {
              if (!integrations.intraDeskApiGateway || !integrations.intraDeskApiKeyEncrypted) throw new Error('Интеграция IntraDesk включена, но API-шлюз или API-ключ не настроен');
              const apiKey = this.decryptApiKey(integrations.intraDeskApiKeyEncrypted);
              const baseUrl = integrations.intraDeskApiGateway.trim().replace(/\\/+$/, '');
              const groupId = Number(rule.intradeskGroup.trim());
              const taskTypeId = Number(rule.intradeskTaskType.trim());
              if (!Number.isSafeInteger(groupId) || groupId <= 0) throw new Error('Группа исполнителей IntraDesk должна содержать числовой ID');
              if (!Number.isSafeInteger(taskTypeId) || taskTypeId <= 0) throw new Error('Тип заявки IntraDesk должен содержать числовой ID');
              const tags = rule.intradeskTags.trim() ? rule.intradeskTags.split(',').map(value => Number(value.trim())) : [];
              if (tags.some(tag => !Number.isSafeInteger(tag) || tag <= 0)) throw new Error('Теги IntraDesk должны содержать числовые ID');
              const blocks: Record<string, string> = {
                tasktype: JSON.stringify({ value: taskTypeId }),
                executor: JSON.stringify({ value: { groupid: groupId } }),
                service: JSON.stringify({ value: rule.intradeskService.trim() }),
                name: JSON.stringify({ value: this.renderTemplate(rule.intradeskSubject, project) }),
                description: JSON.stringify({ value: message }),
              };
              if (tags.length) blocks.tags = JSON.stringify({ value: tags });
              const response = await fetch(baseUrl + '/changes/v3/tasks?ApiKey=' + encodeURIComponent(apiKey), { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ blocks, Channel: 'web' }) });
              const responseText = (await response.text()).slice(0, 4000);
              let data: any = null; try { data = responseText ? JSON.parse(responseText) : null; } catch {}
              const apiError = data && typeof data === 'object' ? (data.ErrorMessage || data.errorMessage || data.error || data.Error) : null;
              if (!response.ok || apiError) throw new Error('IntraDesk HTTP ' + response.status + (apiError ? ': ' + String(apiError) : '') + (responseText ? ' — ' + responseText : ''));
              const number = data?.Number ?? data?.number ?? data?.TaskNumber ?? data?.taskNumber ?? data?.Id ?? data?.id;
              requestNumber = number == null ? '' : String(number);
            } else if (rule.channel === 'pachca') {
              if (!integrations.pachcaApiGateway || !integrations.pachcaApiKeyEncrypted) throw new Error('Интеграция Pachca включена, но API-шлюз или API KEY не настроен');
              const token = this.decryptApiKey(integrations.pachcaApiKeyEncrypted);
              const baseUrl = integrations.pachcaApiGateway.trim().replace(/\\/+$/, '');
              let entityId = Number(rule.pachcaEntityId);
              if (rule.pachcaTargetType === 'direct') {
                const recipientId = Number(rule.pachcaRecipientId);
                if (!Number.isSafeInteger(recipientId) || recipientId <= 0) throw new Error('Для личного сообщения укажите числовой ID сотрудника Pachca');
                const chatResponse = await fetch(baseUrl + '/chats', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ chat: { member_ids: [recipientId], public: false, channel: false } }) });
                const chatText = (await chatResponse.text()).slice(0, 3000);
                let chatData: any = null; try { chatData = chatText ? JSON.parse(chatText) : null; } catch {}
                if (!chatResponse.ok) throw new Error('Pachca: не удалось создать личный чат, HTTP ' + chatResponse.status + ' ' + chatText);
                entityId = Number(chatData?.data?.id ?? chatData?.chat?.id ?? chatData?.id);
              }
              if (!Number.isSafeInteger(entityId) || entityId <= 0) throw new Error(rule.pachcaTargetType === 'direct' ? 'Pachca не вернула ID личного чата' : 'Для канала Pachca укажите числовой ID чата/канала');
              const response = await fetch(baseUrl + '/messages', { method: 'POST', headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ message: { entity_id: entityId, content: message } }) });
              const responseText = (await response.text()).slice(0, 3000);
              let data: any = null; try { data = responseText ? JSON.parse(responseText) : null; } catch {}
              if (!response.ok || data?.error || data?.errors) throw new Error('Pachca HTTP ' + response.status + ': ' + responseText);
              const number = data?.data?.id ?? data?.message?.id ?? data?.id;
              requestNumber = number == null ? '' : String(number);
            } else {
              if (!integrations.smtpHost || !integrations.smtpFromEmail || !rule.emailTo || !rule.emailSubject) throw new Error('Для SMTP укажите сервер, адрес отправителя, адрес получателя и тему письма');
              const nodemailer = require('nodemailer');
              const transporter = nodemailer.createTransport({
                host: integrations.smtpHost, port: integrations.smtpPort, secure: integrations.smtpSecure,
                ...(integrations.smtpUser ? { auth: { user: integrations.smtpUser, pass: this.decryptApiKey(integrations.smtpPasswordEncrypted) } } : {}),
              });
              const result = await transporter.sendMail({
                from: integrations.smtpFromName ? { name: integrations.smtpFromName, address: integrations.smtpFromEmail } : integrations.smtpFromEmail,
                to: rule.emailTo, subject: this.renderTemplate(rule.emailSubject, project), text: message,
              });
              requestNumber = String(result.messageId || '');
            }
            await this.prisma.notificationDelivery.update({ where: { id: delivery.id }, data: { status: 'sent', message, requestNumber, sentAt: new Date() } });
            this.logger.log(`Уведомление отправлено: ruleId=${rule.id}, channel=${rule.channel}, projectId=${project.id}, shop=${shopNumber}${requestNumber ? ', номер/ID=' + requestNumber : ''}`);
            await this.auditDelivery({ ruleId: rule.id, ruleName: rule.name, projectId: project.id, shopNumber, eventType: rule.eventType, eventDate, outcome: 'success', message: rule.channel + ' принял уведомление' + (requestNumber ? ' №/ID ' + requestNumber : '') });
          } catch (error: any) {
            const failure = String(error?.message || error).slice(0, 3000);
            this.logger.error(`Ошибка отправки уведомления: ruleId=${rule.id}, channel=${rule.channel}, projectId=${project.id}, shop=${shopNumber}: ${failure}`);
            try {
              await this.prisma.notificationDelivery.upsert({
                where: unique,
                create: { ruleId: rule.id, projectId: project.id, eventDate, status: 'error', message: failure },
                update: { status: 'error', message: failure, sentAt: new Date() },
              });
            } catch (persistError: any) { this.logger.error('Не удалось сохранить статус отправки: ' + (persistError?.message || persistError)); }
            await this.auditDelivery({ ruleId: rule.id, ruleName: rule.name, projectId: project.id, shopNumber, eventType: rule.eventType, eventDate, outcome: 'error', message: failure });
          }
        }
      }
    } catch (error: any) {
      this.logger.error('Ошибка планировщика уведомлений: ' + (error?.message || error));
    } finally { this.checking = false; }
  }

  findAll() {
    return this.prisma.notificationRule.findMany({ orderBy: { createdAt: 'asc' } });
  }

  private validate(input: any, partial = false) {
    const data: any = {};
    const fields = ['name', 'offsetType', 'eventType', 'days', 'channel', 'enabled', 'sendTime', 'messageTemplate', 'intradeskGroup', 'intradeskService', 'intradeskSubject', 'intradeskTaskType', 'intradeskTags', 'pachcaTargetType', 'pachcaEntityId', 'pachcaRecipientId', 'emailTo', 'emailSubject'];
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
    for (const field of ['intradeskGroup', 'intradeskService', 'intradeskSubject', 'intradeskTaskType']) {
      if (data[field] !== undefined && (typeof data[field] !== 'string' || data[field].length > 500)) throw new BadRequestException('Поля IntraDesk не должны превышать 500 символов');
    }
    if (data.intradeskTags !== undefined && (typeof data.intradeskTags !== 'string' || data.intradeskTags.length > 1000 || (data.intradeskTags.trim() && !/^\d+(\s*,\s*\d+)*$/.test(data.intradeskTags.trim())))) throw new BadRequestException('Теги IntraDesk укажите числовыми ID через запятую');
    if (data.intradeskTags !== undefined) data.intradeskTags = data.intradeskTags.trim();
    if (data.pachcaTargetType !== undefined && !['channel', 'direct'].includes(data.pachcaTargetType)) throw new BadRequestException('Выберите отправку в канал или личное сообщение Pachca');
    for (const field of ['pachcaEntityId', 'pachcaRecipientId', 'emailTo', 'emailSubject']) if (data[field] !== undefined && (typeof data[field] !== 'string' || data[field].length > 1000)) throw new BadRequestException('Проверьте поля Pachca и SMTP (до 1000 символов)');
    const channel = data.channel;
    if (channel === 'intradesk' && !partial) {
      for (const field of ['intradeskGroup', 'intradeskService', 'intradeskSubject', 'intradeskTaskType']) {
        if (typeof data[field] !== 'string' || !data[field].trim()) throw new BadRequestException('Для IntraDesk заполните группу исполнителей, сервис, тип и тему заявки');
        data[field] = data[field].trim();
      }
    }
    if (channel === 'pachca' && !partial) {
      const targetType = data.pachcaTargetType || 'channel';
      if (targetType === 'channel' && !String(data.pachcaEntityId || '').trim()) throw new BadRequestException('Укажите ID канала/чата Pachca');
      if (targetType === 'direct' && !String(data.pachcaRecipientId || '').trim()) throw new BadRequestException('Укажите ID получателя личного сообщения Pachca');
    }
    if (channel === 'smtp' && !partial && (!String(data.emailTo || '').trim() || !String(data.emailSubject || '').trim())) throw new BadRequestException('Для SMTP укажите адрес получателя и тему письма');
    return data;
  }

  async create(input: any) {
    const data = this.validate(input);
    const integration = await this.prisma.integrationSettings.findUnique({ where: { id: 'default' } });
    const enabled = data.channel === 'intradesk' ? integration?.intraDeskEnabled : data.channel === 'pachca' ? integration?.pachcaEnabled : integration?.smtpEnabled;
    if (!enabled) throw new BadRequestException('Сначала включите интеграцию ' + data.channel + ' в разделе «Настройки → Интеграции»');
    if (data.channel === 'pachca' && !integration?.pachcaApiKeyEncrypted) throw new BadRequestException('Сначала настройте API KEY Pachca');
    if (data.channel === 'smtp' && (!integration?.smtpHost || !integration.smtpFromEmail)) throw new BadRequestException('Сначала настройте SMTP');
    return this.prisma.notificationRule.create({ data });
  }

  async update(id: string, input: any) {
    const existing = await this.prisma.notificationRule.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Уведомление не найдено');
    const data = this.validate(input, true);
    const channel = data.channel ?? existing.channel;
    const integration = await this.prisma.integrationSettings.findUnique({ where: { id: 'default' } });
    const enabled = channel === 'intradesk' ? integration?.intraDeskEnabled : channel === 'pachca' ? integration?.pachcaEnabled : integration?.smtpEnabled;
    if (!enabled) throw new BadRequestException('Сначала включите интеграцию ' + channel + ' в разделе «Настройки → Интеграции»');
    if (channel === 'pachca' && !integration?.pachcaApiKeyEncrypted) throw new BadRequestException('Сначала настройте API KEY Pachca');
    if (channel === 'smtp' && (!integration?.smtpHost || !integration.smtpFromEmail)) throw new BadRequestException('Сначала настройте SMTP');
    if (channel === 'intradesk') {
      for (const field of ['intradeskGroup', 'intradeskService', 'intradeskSubject', 'intradeskTaskType']) {
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
