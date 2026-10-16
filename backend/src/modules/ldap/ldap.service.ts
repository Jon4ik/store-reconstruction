import { BadRequestException, BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';
import { PrismaService } from '../../prisma.service';

const { Client } = require('ldapts') as { Client: new (options: any) => any };
const TU_TITLE = 'Территориальный управляющий';

@Injectable()
export class LdapService {
  constructor(private readonly prisma: PrismaService) {}

  private key(): Buffer {
    const raw = process.env.LDAP_ENCRYPTION_KEY || '';
    const value = /^[a-f0-9]{64}$/i.test(raw) ? Buffer.from(raw, 'hex') : Buffer.from(raw, 'base64');
    if (value.length !== 32) throw new ServiceUnavailableException('LDAP_ENCRYPTION_KEY должен быть случайным ключом длиной 32 байта (64 hex-символа).');
    return value;
  }

  private hasKey() { try { this.key(); return true; } catch { return false; } }

  private encrypt(value: string): string {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.key(), iv);
    const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
    return [iv.toString('hex'), cipher.getAuthTag().toString('hex'), encrypted.toString('hex')].join(':');
  }

  private decrypt(value: string): string {
    const [iv, tag, ciphertext] = value.split(':');
    if (!iv || !tag || !ciphertext) throw new ServiceUnavailableException('Сохранённый пароль LDAP повреждён.');
    const decipher = createDecipheriv('aes-256-gcm', this.key(), Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'hex')), decipher.final()]).toString('utf8');
  }

  private getStored() { return this.prisma.ldapSettings.findUnique({ where: { id: 'default' } }); }

  async getSettings() {
    const config = await this.getStored();
    return {
      url: config?.url || '',
      baseDN: config?.baseDN || '',
      bindDN: config?.bindDN || '',
      passwordConfigured: Boolean(config?.bindPasswordEncrypted),
      encryptionConfigured: this.hasKey(),
    };
  }

  async getStatus() {
    const config = await this.getStored();
    return { configured: Boolean(config?.url && config.baseDN && config.bindDN && config.bindPasswordEncrypted && this.hasKey()) };
  }

  async saveSettings(input: any) {
    const current = await this.getStored();
    const url = input.url === undefined ? (current?.url || '') : String(input.url).trim();
    const baseDN = input.baseDN === undefined ? (current?.baseDN || '') : String(input.baseDN).trim();
    const bindDN = input.bindDN === undefined ? (current?.bindDN || '') : String(input.bindDN).trim();
    if (url && !/^ldaps?:\/\//i.test(url)) throw new BadRequestException('URL должен начинаться с ldap:// или ldaps://');
    if ([url, baseDN, bindDN].some((field) => field.length > 500)) throw new BadRequestException('Поля LDAP не должны превышать 500 символов');
    let encrypted = current?.bindPasswordEncrypted || '';
    if (input.clearBindPassword === true) encrypted = '';
    else if (typeof input.bindPassword === 'string' && input.bindPassword.length) {
      if (input.bindPassword.length > 2048) throw new BadRequestException('Пароль LDAP слишком длинный');
      encrypted = this.encrypt(input.bindPassword);
    }
    await this.prisma.ldapSettings.upsert({
      where: { id: 'default' },
      create: { id: 'default', url, baseDN, bindDN, bindPasswordEncrypted: encrypted },
      update: { url, baseDN, bindDN, bindPasswordEncrypted: encrypted },
    });
    return this.getSettings();
  }

  async getIntegrationSettings() {
    const config = await this.getStored();
    return { enabled: Boolean(config?.intraDeskEnabled), apiGateway: config?.intraDeskApiGateway || '', apiKeyConfigured: Boolean(config?.intraDeskApiKeyEncrypted), encryptionConfigured: this.hasKey() };
  }

  async saveIntegrationSettings(input: any) {
    const current = await this.getStored();
    const enabled = input.enabled === undefined ? Boolean(current?.intraDeskEnabled) : input.enabled;
    const apiGateway = input.apiGateway === undefined ? (current?.intraDeskApiGateway || '') : String(input.apiGateway).trim();
    if (typeof enabled !== 'boolean') throw new BadRequestException('Флаг интеграции должен быть boolean');
    if (apiGateway.length > 1000 || (apiGateway && !/^https?:\/\//i.test(apiGateway))) throw new BadRequestException('Укажите корректный URL API-шлюза IntraDesk');
    let apiKeyEncrypted = current?.intraDeskApiKeyEncrypted || '';
    if (input.clearApiKey === true) apiKeyEncrypted = '';
    else if (typeof input.apiKey === 'string' && input.apiKey.length) {
      if (input.apiKey.length > 4096) throw new BadRequestException('API-ключ слишком длинный');
      apiKeyEncrypted = this.encrypt(input.apiKey);
    }
    if (enabled && (!apiGateway || !apiKeyEncrypted)) throw new BadRequestException('Для включения интеграции укажите API-шлюз и API-ключ');
    await this.prisma.ldapSettings.upsert({ where: { id: 'default' }, create: { id: 'default', intraDeskEnabled: enabled, intraDeskApiGateway: apiGateway, intraDeskApiKeyEncrypted: apiKeyEncrypted }, update: { intraDeskEnabled: enabled, intraDeskApiGateway: apiGateway, intraDeskApiKeyEncrypted: apiKeyEncrypted } });
    return this.getIntegrationSettings();
  }

  private async connect(overrides?: { url?: string; baseDN?: string; bindDN?: string; bindPassword?: string }) {
    const stored = await this.getStored();
    const config = {
      url: overrides?.url?.trim() || stored?.url || '',
      baseDN: overrides?.baseDN?.trim() || stored?.baseDN || '',
      bindDN: overrides?.bindDN?.trim() || stored?.bindDN || '',
      bindPasswordEncrypted: stored?.bindPasswordEncrypted || '',
    };
    if (!config.url || !config.baseDN || !config.bindDN) throw new BadRequestException('Заполните URL, Base DN и Bind DN в настройках LDAP.');
    if (!config.url.startsWith('ldap://') && !config.url.startsWith('ldaps://')) throw new BadRequestException('URL должен начинаться с ldap:// или ldaps://');
    const password = overrides?.bindPassword || (config.bindPasswordEncrypted ? this.decrypt(config.bindPasswordEncrypted) : '');
    if (!password) throw new BadRequestException('Укажите пароль сервисной учётной записи LDAP.');
    const client = new Client({ url: config.url, timeout: 10000, connectTimeout: 10000 });
    try {
      await client.bind(config.bindDN, password);
      return { client, config };
    } catch {
      try { await client.unbind(); } catch {}
      throw new BadGatewayException('LDAP bind не выполнен. Проверьте URL, сертификат и учётные данные.');
    }
  }

  async testConnection(overrides?: { url?: string; baseDN?: string; bindDN?: string; bindPassword?: string }) {
    const { client } = await this.connect(overrides);
    try { return { success: true, message: 'Подключение к LDAP успешно' }; }
    finally { try { await client.unbind(); } catch {} }
  }

  private raw(entry: any, name: string): any {
    const value = entry?.[name];
    return Array.isArray(value) ? value[0] : value;
  }

  private textValue(entry: any, name: string): string {
    const value = this.raw(entry, name);
    if (value === undefined || value === null) return '';
    return Buffer.isBuffer(value) ? value.toString('utf8').replace(/\0+$/g, '') : String(value).trim();
  }

  private guidValue(entry: any): string {
    const value = this.raw(entry, 'objectGUID');
    if (value === undefined || value === null) return '';
    if (Buffer.isBuffer(value)) return value.toString('hex');
    const stringValue = String(value);
    return /^[a-f0-9]{32}$/i.test(stringValue) ? stringValue.toLowerCase() : Buffer.from(stringValue).toString('hex');
  }

  async syncTUs(actorId: string, actorName: string) {
    const { client, config } = await this.connect();
    let created = 0, updated = 0, disabled = 0, skipped = 0;
    try {
      const response = await client.search(config.baseDN, {
        scope: 'sub',
        filter: '(&(objectCategory=person)(objectClass=user)(title=Территориальный управляющий))',
        attributes: ['objectGUID', 'displayName', 'cn', 'title', 'mail', 'mobile', 'telephoneNumber', 'userAccountControl'],
        paged: { pageSize: 500 },
      });
      const entries: any[] = response.searchEntries || [];
      for (const entry of entries) {
        const title = this.textValue(entry, 'title');
        if (title.toLocaleLowerCase('ru-RU') !== TU_TITLE.toLocaleLowerCase('ru-RU')) { skipped++; continue; }
        const guid = this.guidValue(entry);
        const fullName = this.textValue(entry, 'displayName') || this.textValue(entry, 'cn');
        if (!guid || fullName.length < 2) { skipped++; continue; }
        const email = this.textValue(entry, 'mail') || null;
        const phone = this.textValue(entry, 'mobile') || this.textValue(entry, 'telephoneNumber') || null;
        const control = Number.parseInt(this.textValue(entry, 'userAccountControl') || '0', 10);
        const enabled = Number.isFinite(control) && (control & 2) === 0;
        const existing = await this.prisma.tU.findFirst({
          where: { OR: [{ adObjectGuid: guid }, ...(email ? [{ email: { equals: email, mode: 'insensitive' as const } }] : [])] },
        });
        const data = { adObjectGuid: guid, fullName, position: title, email, phone, isActive: enabled };
        if (!enabled) {
          if (existing) {
            await this.prisma.tU.update({ where: { id: existing.id }, data });
            if (existing.isActive) disabled++;
            else updated++;
          } else {
            // Keep disabled AD users in the directory as inactive records so
            // subsequent syncs can track them and they cannot be accidentally re-added.
            await this.prisma.tU.create({ data });
            created++;
            disabled++;
          }
          continue;
        }
        if (existing) { await this.prisma.tU.update({ where: { id: existing.id }, data }); updated++; }
        else { await this.prisma.tU.create({ data }); created++; }
      }
      const summary = { found: entries.length, created, updated, disabled, skipped };
      await this.prisma.auditLog.create({
        data: { userId: actorId, userName: actorName || 'Система', action: 'sync_tus_ad', field: 'ldap', newValue: JSON.stringify(summary), details: 'Синхронизация справочника ТУ с Active Directory' },
      });
      return { success: true, ...summary };
    } catch (error: any) {
      if (error?.status) throw error;
      throw new BadGatewayException('Не удалось прочитать LDAP/Active Directory. Проверьте настройки и доступность контроллера домена.');
    } finally {
      try { await client.unbind(); } catch {}
    }
  }
}
