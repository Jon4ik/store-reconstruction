import { BadGatewayException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { PrismaService } from '../../prisma.service';

const execFileAsync = promisify(execFile);
type SourceShop = { shopNumber: string; city: string; address: string; workHours: string; areaManager: string; areaManagerPhone: string; tu: string; directorate: string };

@Injectable()
export class ShopsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(search = '', limit = 100) {
    const term = search.trim().slice(0, 150);
    const where = term ? { OR: [
      { shopNumber: { contains: term, mode: 'insensitive' as const } },
      { city: { contains: term, mode: 'insensitive' as const } },
      { address: { contains: term, mode: 'insensitive' as const } },
      { areaManager: { contains: term, mode: 'insensitive' as const } },
      { tu: { contains: term, mode: 'insensitive' as const } },
    ] } : {};
    const [data, total] = await Promise.all([
      this.prisma.shopDirectory.findMany({ where, orderBy: { shopNumber: 'asc' }, take: limit }),
      this.prisma.shopDirectory.count({ where }),
    ]);
    return { data, total };
  }

  async lookupByNumber(number: string) {
    const padded = number.padStart(3, '0');
    return this.prisma.shopDirectory.findMany({
      where: { OR: [{ shopNumber: padded }, { shopNumber: number }] },
      orderBy: { shopNumber: 'asc' },
      take: 20,
    });
  }

  private async readSource(): Promise<SourceShop[]> {
    const server = process.env.UKM_SQL_SERVER?.trim();
    const database = process.env.UKM_SQL_DATABASE?.trim();
    const user = process.env.UKM_SQL_USER?.trim();
    const password = process.env.UKM_SQL_PASSWORD;
    if (!server || !database || !user || password === undefined) {
      throw new ServiceUnavailableException('Не настроено подключение к источнику магазинов: проверьте UKM_SQL_SERVER, UKM_SQL_DATABASE, UKM_SQL_USER и UKM_SQL_PASSWORD в .env.');
    }
    const python = process.env.PYTHON_EXECUTABLE || (process.platform === 'win32' ? 'python' : 'python3');
    const script = join(__dirname, '../../../scripts/sync_shops_source.py');
    try {
      const { stdout } = await execFileAsync(python, [script], { timeout: 120000, maxBuffer: 20 * 1024 * 1024, env: { ...process.env }, windowsHide: true });
      const parsed = JSON.parse(stdout);
      if (!Array.isArray(parsed)) throw new Error('Источник вернул данные неизвестного формата');
      return parsed.map((row: any) => ({
        shopNumber: String(row.shopNumber ?? '').trim().padStart(3, '0'),
        city: String(row.city ?? '').trim(),
        address: String(row.address ?? '').trim(),
        workHours: String(row.workHours ?? '').trim(),
        areaManager: String(row.areaManager ?? '').trim(),
        areaManagerPhone: String(row.areaManagerPhone ?? '').trim(),
        tu: String(row.tu ?? '').trim(),
        directorate: String(row.directorate ?? '').trim(),
      })).filter(row => row.shopNumber && row.address);
    } catch (error: any) {
      const detail = String(error?.stderr || error?.message || '');
      console.error('Shop source synchronization failed:', detail.slice(0, 2000));
      if (error?.status === 127 || /ENOENT/.test(detail)) {
        throw new ServiceUnavailableException('Не найден Python. Установите Python и пакет pyodbc, либо задайте PYTHON_EXECUTABLE в .env.');
      }
      if (/UKM_SQL_|pyodbc|ODBC|SQL Server|login failed|timeout/i.test(detail)) {
        throw new BadGatewayException('Не удалось подключиться к источнику магазинов. Проверьте настройки UKM_SQL_* и установленный ODBC Driver for SQL Server.');
      }
      throw new BadGatewayException('Не удалось прочитать справочник магазинов из источника данных.');
    }
  }

  async syncShops(actor?: { id: string; name: string }) {
    const source = await this.readSource();
    let created = 0;
    let updated = 0;
    let unchanged = 0;
    for (const item of source) {
      const existing = await this.prisma.shopDirectory.findUnique({ where: { shopNumber: item.shopNumber } });
      if (!existing) {
        await this.prisma.shopDirectory.create({ data: item });
        created++;
        continue;
      }
      const changed = (Object.keys(item) as (keyof SourceShop)[]).some(key => existing[key] !== item[key]);
      if (changed) {
        await this.prisma.shopDirectory.update({ where: { shopNumber: item.shopNumber }, data: item });
        updated++;
      } else unchanged++;
    }
    const summary = { success: true, sourceCount: source.length, created, updated, unchanged, deleted: 0 };
    if (actor) {
      await this.prisma.auditLog.create({
        data: { userId: actor.id, userName: actor.name, action: 'sync_shops', field: 'shop_directory', newValue: JSON.stringify(summary), details: 'Синхронизация справочника магазинов из SQL Server' },
      });
    }
    return summary;
  }
}
