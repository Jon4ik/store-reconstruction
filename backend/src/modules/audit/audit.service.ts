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
}
