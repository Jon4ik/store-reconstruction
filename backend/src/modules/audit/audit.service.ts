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

    const where: any = {};
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
    return { data, total, page, limit };
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
          userName: userName || 'Система',
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
