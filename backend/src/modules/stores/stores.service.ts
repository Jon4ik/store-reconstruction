import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

const DATE_FIELDS = ['closureDate', 'demolitionDate', 'installationDate', 'techOpenDate'] as const;
const WORK_TYPES = ['Закрытие', 'Реконструкция', 'Открытие'];
const ALLOWED_STATUS = ['Запланирован', 'В работе', 'Завершено', 'Просрочено', 'Отменено', 'Отмена', 'Закрыт для покупателей', 'Демонтаж', 'Монтаж', 'Техническое открытие', 'Открытие', 'Удален'];

@Injectable()
export class StoresService {
  constructor(private prisma: PrismaService) {}

  private convertDate(value: unknown): Date | null {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date) {
      if (!Number.isNaN(value.getTime())) return value;
      throw new BadRequestException('Некорректная дата');
    }
    if (typeof value !== 'string') throw new BadRequestException('Дата должна быть строкой');
    const match = value.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
    if (match) {
      const day = Number(match[1]), month = Number(match[2]), year = Number(match[3]);
      const date = new Date(Date.UTC(year, month - 1, day));
      if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month - 1 || date.getUTCDate() !== day) {
        throw new BadRequestException(`Несуществующая дата: ${value}`);
      }
      return date;
    }
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) throw new BadRequestException(`Некорректная дата: ${value}`);
    return date;
  }

  private dateOnly(value: unknown): string {
    if (value === null || value === undefined || value === '') return '';
    const date = value instanceof Date ? value : this.convertDate(value);
    if (!date) return '';
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }

  private auditDate(value: unknown): string {
    const key = this.dateOnly(value);
    if (!key) return '';
    const [year, month, day] = key.split('-');
    return `${day}.${month}.${year}`;
  }

  private validateDates(data: any) {
    const parsed: Array<{ field: string; date: Date }> = [];
    for (const field of DATE_FIELDS) {
      const value = data[field];
      if (value !== undefined && value !== null && value !== '') {
        const date = this.convertDate(value);
        if (date) parsed.push({ field, date });
      }
    }
    for (let i = 1; i < parsed.length; i++) {
      if (parsed[i - 1].date.getTime() > parsed[i].date.getTime()) {
        throw new BadRequestException(`Дата "${parsed[i].field}" не может быть раньше "${parsed[i - 1].field}"`);
      }
    }
  }

  private validateText(value: unknown, field: string, max = 300) {
    if (typeof value !== 'string' || value.trim().length < 1 || value.trim().length > max) {
      throw new BadRequestException(`Некорректное поле "${field}"`);
    }
    return value.trim();
  }

  async findAll(query: any) {
    const page = Number(query.page ?? 1);
    const limit = Number(query.limit ?? 50);
    if (!Number.isInteger(page) || page < 1 || page > 100000) throw new BadRequestException('Некорректная страница');
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) throw new BadRequestException('limit должен быть от 1 до 200');

    const where: any = { isDeleted: false };
    if (query.search) {
      const search = String(query.search).slice(0, 200);
      where.OR = [
        { storeNumber: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    if (query.workType) {
      if (!WORK_TYPES.includes(String(query.workType))) throw new BadRequestException('Некорректный тип работ');
      where.workType = String(query.workType);
    }
    if (query.status) where.status = String(query.status).slice(0, 80);
    if (query.tuId) where.tuId = String(query.tuId);
    if (query.city) where.city = String(query.city).slice(0, 150);

    const [data, total] = await Promise.all([
      this.prisma.storeProject.findMany({
        where, include: { tu: true },
        skip: (page - 1) * limit, take: limit, orderBy: { createdAt: 'desc' },
      }),
      this.prisma.storeProject.count({ where }),
    ]);
    return { data, total, page, limit };
  }

  async findOne(id: string) {
    const store = await this.prisma.storeProject.findFirst({
      where: { id, isDeleted: false },
      include: {
        tu: true,
        comments: {
          include: { user: { select: { id: true, username: true, fullName: true } } },
          orderBy: { createdAt: 'desc' },
        },
      },
    });
    if (!store) throw new NotFoundException('Объект не найден');
    return store;
  }

  async create(data: any, userId: string, userName: string) {
    const storeNumber = this.validateText(data.storeNumber, 'storeNumber', 100);
    const address = this.validateText(data.address, 'address', 300);
    const city = this.validateText(data.city || address.split(',')[0], 'city', 150);
    if (!WORK_TYPES.includes(data.workType)) throw new BadRequestException('Некорректный тип работ');
    if (typeof data.tuId !== 'string' || !data.tuId) throw new BadRequestException('Необходимо указать ТУ');
    const tu = await this.prisma.tU.findFirst({ where: { id: data.tuId, isActive: true }, select: { id: true } });
    if (!tu) throw new BadRequestException('ТУ не найден или отключён');

    if (data.status !== undefined && (typeof data.status !== 'string' || !ALLOWED_STATUS.includes(data.status))) {
      throw new BadRequestException('Некорректный статус');
    }
    if (data.rowColor !== undefined && (typeof data.rowColor !== 'string' || data.rowColor.length > 32)) {
      throw new BadRequestException('Некорректный цвет строки');
    }
    if (data.comment !== undefined && (typeof data.comment !== 'string' || data.comment.length > 5000)) {
      throw new BadRequestException('Комментарий слишком длинный');
    }
    const clean: any = {
      storeNumber, address, city, workType: data.workType, tuId: tu.id, createdBy: userId,
      rowColor: typeof data.rowColor === 'string' ? data.rowColor.slice(0, 32) : '',
      comment: typeof data.comment === 'string' ? data.comment.slice(0, 5000) : '',
      status: typeof data.status === 'string' ? data.status : 'Запланирован',
      manualStatus: typeof data.manualStatus === 'string' ? data.manualStatus.slice(0, 80) : null,
    };
    for (const field of DATE_FIELDS) clean[field] = this.convertDate(data[field]);
    this.validateDates(clean);

    return this.prisma.$transaction(async (tx) => {
      const store = await tx.storeProject.create({ data: clean, include: { tu: true } });
      await tx.auditLog.create({
        data: { storeId: store.id, userId, userName, action: 'create', field: 'project', newValue: store.storeNumber, details: `Создан объект №${store.storeNumber}` },
      });
      return store;
    });
  }

  async update(id: string, data: any, userId: string, userName: string) {
    const existing = await this.prisma.storeProject.findFirst({ where: { id, isDeleted: false }, include: { tu: true } });
    if (!existing) throw new NotFoundException('Объект не найден');

    const clean: any = {};
    for (const field of ['storeNumber', 'address', 'city'] as const) {
      if (data[field] !== undefined) clean[field] = this.validateText(data[field], field, field === 'address' ? 300 : 150);
    }
    if (data.workType !== undefined) {
      if (!WORK_TYPES.includes(data.workType)) throw new BadRequestException('Некорректный тип работ');
      clean.workType = data.workType;
    }
    if (data.status !== undefined) {
      if (typeof data.status !== 'string' || !ALLOWED_STATUS.includes(data.status)) throw new BadRequestException('Некорректный статус');
      clean.status = data.status;
    }
    if (data.manualStatus !== undefined) {
      if (data.manualStatus !== null && (typeof data.manualStatus !== 'string' || data.manualStatus.length > 80)) throw new BadRequestException('Некорректный ручной статус');
      clean.manualStatus = data.manualStatus;
    }
    if (data.rowColor !== undefined) {
      if (typeof data.rowColor !== 'string' || data.rowColor.length > 32) throw new BadRequestException('Некорректный цвет строки');
      clean.rowColor = data.rowColor;
    }
    if (data.comment !== undefined) {
      if (typeof data.comment !== 'string' || data.comment.length > 5000) throw new BadRequestException('Комментарий слишком длинный');
      clean.comment = data.comment;
    }
    if (data.tuId !== undefined) {
      if (typeof data.tuId !== 'string') throw new BadRequestException('Некорректный ТУ');
      const tu = await this.prisma.tU.findFirst({ where: { id: data.tuId, isActive: true }, select: { id: true } });
      if (!tu) throw new BadRequestException('ТУ не найден или отключён');
      clean.tuId = tu.id;
    }
    for (const field of DATE_FIELDS) {
      if (data[field] !== undefined) {
        const nextDate = this.convertDate(data[field]);
        // These fields represent calendar dates, not timestamps. Ignore time-zone/time
        // differences when a form submits an unchanged date.
        if (this.dateOnly(existing[field]) !== this.dateOnly(nextDate)) clean[field] = nextDate;
      }
    }
    if (Object.keys(clean).length === 0) throw new BadRequestException('Нет допустимых полей для изменения');
    this.validateDates({ ...existing, ...clean });

    return this.prisma.$transaction(async (tx) => {
      const store = await tx.storeProject.update({ where: { id }, data: clean, include: { tu: true } });
      // Цвет строки — отдельное событие аудита. Не дублируем его как обычное изменение поля.
      if (clean.rowColor !== undefined && existing.rowColor !== clean.rowColor) {
        await tx.auditLog.create({ data: { storeId: id, userId, userName, action: 'change_color', field: 'rowColor', oldValue: existing.rowColor || '', newValue: clean.rowColor, details: 'Изменён цвет строки объекта' } });
      }
      for (const [field, newValue] of Object.entries(clean)) {
        if (field === 'rowColor') continue;
        const oldValue = (existing as any)[field];
        const isDateField = (DATE_FIELDS as readonly string[]).includes(field);
        const normalizedOld = isDateField ? this.auditDate(oldValue) : oldValue instanceof Date ? oldValue.toISOString() : String(oldValue ?? '');
        const normalizedNew = isDateField ? this.auditDate(newValue) : newValue instanceof Date ? newValue.toISOString() : String(newValue ?? '');
        if (normalizedOld === normalizedNew) continue;
        await tx.auditLog.create({
          data: {
            storeId: id, userId, userName, action: 'update', field,
            oldValue: normalizedOld.slice(0, 500), newValue: normalizedNew.slice(0, 500),
            details: `Изменено поле "${field}"`,
          },
        });
      }
      return store;
    });
  }

  async remove(id: string, userId: string, userName: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.storeProject.findFirst({ where: { id, isDeleted: false } });
      if (!existing) throw new NotFoundException('Объект не найден');
      const store = await tx.storeProject.update({ where: { id }, data: { isDeleted: true, status: 'Удален' } });
      await tx.auditLog.create({
        data: { storeId: id, userId, userName, action: 'delete', field: 'project', oldValue: 'active', newValue: 'deleted', details: 'Объект удалён (soft delete)' },
      });
      return store;
    });
  }

  async restore(id: string, userId: string, userName: string) {
    return this.prisma.$transaction(async (tx) => {
      const existing = await tx.storeProject.findUnique({ where: { id } });
      if (!existing) throw new NotFoundException('Объект не найден');
      if (!existing.isDeleted) return existing;
      const store = await tx.storeProject.update({ where: { id }, data: { isDeleted: false, status: 'Запланирован' } });
      await tx.auditLog.create({
        data: { storeId: id, userId, userName, action: 'restore', field: 'project', oldValue: 'deleted', newValue: 'active', details: 'Объект восстановлен' },
      });
      return store;
    });
  }

  async getDashboard() {
    const projects = await this.prisma.storeProject.findMany({ where: { isDeleted: false } });
    return {
      total: projects.length,
      closures: projects.filter(p => p.workType === 'Закрытие').length,
      reconstructions: projects.filter(p => p.workType === 'Реконструкция').length,
      completed: projects.filter(p => p.status === 'Завершено').length,
      overdue: projects.filter(p => p.status === 'Просрочено').length,
      cancelled: projects.filter(p => ['Отменено', 'Отмена'].includes(p.status)).length,
    };
  }

  async getComments(storeId: string) {
    const store = await this.prisma.storeProject.findFirst({ where: { id: storeId, isDeleted: false }, select: { id: true } });
    if (!store) throw new NotFoundException('Объект не найден');
    return this.prisma.comment.findMany({ where: { storeId }, orderBy: { createdAt: 'desc' } });
  }

  async addComment(storeId: string, userId: string, userName: string, text: string) {
    if (typeof text !== 'string' || text.trim().length === 0 || text.length > 5000) throw new BadRequestException('Комментарий должен содержать 1–5000 символов');
    return this.prisma.$transaction(async (tx) => {
      const store = await tx.storeProject.findFirst({ where: { id: storeId, isDeleted: false }, select: { id: true } });
      if (!store) throw new NotFoundException('Объект не найден');
      const comment = await tx.comment.create({ data: { storeId, userId, userName, text: text.trim() } });
      await tx.auditLog.create({
        data: { storeId, userId, userName, action: 'add_comment', field: 'comment', newValue: text.trim().slice(0, 50), details: 'Добавлен комментарий' },
      });
      return comment;
    });
  }

  async deleteComment(commentId: string, userId: string, userName: string) {
    return this.prisma.$transaction(async (tx) => {
      const comment = await tx.comment.findUnique({ where: { id: commentId } });
      if (!comment) throw new NotFoundException('Комментарий не найден');
      await tx.comment.delete({ where: { id: commentId } });
      await tx.auditLog.create({
        data: { storeId: comment.storeId, userId, userName, action: 'delete_comment', field: 'comment', oldValue: comment.text.slice(0, 50), details: 'Удалён комментарий' },
      });
      return { success: true };
    });
  }
}
