import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

@Injectable()
export class TUsService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.tU.findMany({ orderBy: { fullName: 'asc' } });
  }

  async findOne(id: string) {
    const tu = await this.prisma.tU.findUnique({ where: { id } });
    if (!tu) throw new NotFoundException('ТУ не найден');
    return tu;
  }

  async create(data: any, userId?: string, userName?: string) {
    const fullName = typeof data.fullName === 'string' ? data.fullName.trim() : '';
    if (fullName.length < 2 || fullName.length > 120) throw new BadRequestException('Некорректное ФИО ТУ');
    const phone = typeof data.phone === 'string' ? data.phone.trim() : '';
    const email = typeof data.email === 'string' ? data.email.trim() : '';
    if (phone.length > 40 || (phone && !/^[+0-9() .-]{5,40}$/.test(phone))) throw new BadRequestException('Некорректный телефон');
    if (email.length > 254 || (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))) throw new BadRequestException('Некорректный email');
    if (data.isActive !== undefined && typeof data.isActive !== 'boolean') throw new BadRequestException('isActive должен быть boolean');
    const clean = {
      fullName,
      position: typeof data.position === 'string' ? data.position.trim().slice(0, 120) : 'Территориальный управляющий',
      phone: phone || null,
      email: email || null,
      isActive: data.isActive !== false,
    };

    return this.prisma.$transaction(async (tx) => {
      const tu = await tx.tU.create({ data: clean });
      if (userId) {
        await tx.auditLog.create({
          data: { userId, action: 'create_tu', field: 'tu', newValue: tu.fullName, details: `Создан ТУ ${tu.fullName}` },
        });
      }
      return tu;
    });
  }

  async update(id: string, data: any, userId?: string, userName?: string) {
    const existing = await this.prisma.tU.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('ТУ не найден');
    const clean: any = {};
    if (data.fullName !== undefined) {
      if (typeof data.fullName !== 'string' || data.fullName.trim().length < 2 || data.fullName.trim().length > 120) throw new BadRequestException('Некорректное ФИО ТУ');
      clean.fullName = data.fullName.trim();
    }
    if (data.position !== undefined) {
      if (typeof data.position !== 'string' || data.position.length > 120) throw new BadRequestException('Некорректная должность');
      clean.position = data.position.trim();
    }
    if (data.phone !== undefined) {
      if (data.phone !== null && (typeof data.phone !== 'string' || data.phone.length > 40)) throw new BadRequestException('Некорректный телефон');
      clean.phone = data.phone?.trim() || null;
    }
    if (data.email !== undefined) {
      if (data.email !== null && (typeof data.email !== 'string' || data.email.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email))) throw new BadRequestException('Некорректный email');
      clean.email = data.email?.trim() || null;
    }
    if (data.isActive !== undefined) {
      if (typeof data.isActive !== 'boolean') throw new BadRequestException('isActive должен быть boolean');
      clean.isActive = data.isActive;
    }
    if (!Object.keys(clean).length) throw new BadRequestException('Нет допустимых полей для изменения');

    return this.prisma.$transaction(async (tx) => {
      const tu = await tx.tU.update({ where: { id }, data: clean });
      if (userId) {
        for (const field of Object.keys(clean)) {
          if (String((existing as any)[field] ?? '') !== String((tu as any)[field] ?? '')) {
            await tx.auditLog.create({
              data: { userId, action: 'update_tu', field, oldValue: String((existing as any)[field] ?? ''), newValue: String((tu as any)[field] ?? ''), details: `Изменено поле "${field}" ТУ ${tu.fullName}` },
            });
          }
        }
      }
      return tu;
    });
  }

  async remove(id: string, userId?: string, userName?: string) {
    const existing = await this.prisma.tU.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('ТУ не найден');
    return this.prisma.$transaction(async (tx) => {
      const tu = await tx.tU.update({ where: { id }, data: { isActive: false } });
      if (userId) {
        await tx.auditLog.create({
          data: { userId, action: 'disable_tu', field: 'tu', oldValue: existing.fullName, details: `Отключён ТУ ${existing.fullName}; история объектов сохранена` },
        });
      }
      return tu;
    });
  }
}
