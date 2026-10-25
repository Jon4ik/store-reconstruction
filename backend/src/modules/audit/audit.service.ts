import { STORE_FIELD_LABELS } from './store-labels';
import { BadRequestException, Injectable } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class AuditService {
  constructor(private prisma: PrismaService) {}

  async findAll(query: any) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 100);
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw new BadRequestException('Некорректный номер страницы');
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new BadRequestException('limit должен быть от 1 до 200');

    const where: any = { NOT: { action: 'api_request', OR: [{ newValue: { contains: '/auth/me/profile' } }, { newValue: { contains: '/auth/me/change-password' } }] } };
    if (query.userId) where.userId = String(query.userId);
    if (query.storeId) where.storeId = String(query.storeId);
    if (query.action) where.action = String(query.action).slice(0, 80);

    const [data, total] = await Promise.all([
      this.prisma.auditLog.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        // Stable ordering prevents rows with the same timestamp from moving
        // unpredictably between pages.
        orderBy: [{ timestamp: 'desc' }, { id: 'desc' }],
      }),
      this.prisma.auditLog.count({ where }),
    ]);
    const tuIds = data.filter(row => row.field === 'tuId').flatMap(row => [row.oldValue, row.newValue]);
    const tus = await this.prisma.tU.findMany({ where: { id: { in: tuIds } }, select: { id: true, fullName: true } });
    const names = new Map(tus.map(tu => [tu.id, tu.fullName]));
    const users = await this.prisma.user.findMany({ where: { id: { in: data.map(row => row.userId).filter((id): id is string => !!id) } }, select: { id: true, fullName: true } });
    const actorNames = new Map(users.map(user => [user.id, user.fullName]));
    const colors: Record<string, string> = { '': 'Без цвета', '#fee2e2': 'Красный', '#fef3c7': 'Жёлтый', '#dcfce7': 'Зелёный', '#dbeafe': 'Голубой', '#f3e8ff': 'Фиолетовый', '#fce7f3': 'Розовый' };
    const valueLabel = (field: string, value: string) => {
      if (field === 'tuId') return names.get(value) || (/^[a-f0-9-]{36}$/i.test(value) ? 'ТУ отсутствует в справочнике' : value || 'Не выбран');
      if (field === 'rowColor') return colors[value] || value;
      if (field === 'project') return ({ active: 'Активен', deleted: 'Удалён' } as Record<string, string>)[value] || value;
      return value;
    };
    return { data: data.map(row => ({ ...row,
      userName: (row.userId && actorNames.get(row.userId)) || (row.userId ? 'Пользователь удалён' : 'Система'),
      details: row.action === 'update' && STORE_FIELD_LABELS[row.field] ? `Изменено поле «${STORE_FIELD_LABELS[row.field]}»` : row.details,
      oldValue: valueLabel(row.field, row.oldValue), newValue: valueLabel(row.field, row.newValue),
    })), total, page, limit };
  }

  async clear(userId: string, userName?: string) {
    return this.prisma.$transaction(async (tx) => {
      // The database trigger allows DELETE only inside this explicitly authorized transaction.
      await tx.$queryRaw`SELECT set_config('app.audit_log_clear', 'on', true)`;
      const { count } = await tx.auditLog.deleteMany({});
      // Keep a trace of the destructive action in the newly cleared journal.
      await tx.auditLog.create({
        data: {
          userId,
          action: 'clear_audit',
          field: 'audit',
          oldValue: String(count),
          details: `Журнал аудита очищен. Удалено записей: ${count}`,
        },
      });
      return { deletedCount: count };
    });
  }
}
