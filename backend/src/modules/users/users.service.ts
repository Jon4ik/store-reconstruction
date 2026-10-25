import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import * as bcrypt from 'bcrypt';

const PROTECTED_SYSTEM_USERS = new Set(['admin', 'manager', 'viewer']);

const publicUserSelect = {
  id: true,
  username: true,
  fullName: true,
  roleId: true,
  role: { select: { id: true, name: true, permissions: true } },
  isActive: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class UsersService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.user.findMany({
      select: publicUserSelect,
      orderBy: { createdAt: 'desc' },
    });
  }

  async findOne(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!user) throw new NotFoundException('Пользователь не найден');
    return user;
  }

  async create(data: any, actorId?: string, actorName?: string) {
    const username = typeof data.username === 'string' ? data.username.trim() : '';
    const fullName = typeof data.fullName === 'string' ? data.fullName.trim() : '';
    const password = typeof data.password === 'string' ? data.password : '';
    const roleId = typeof data.roleId === 'string' ? data.roleId : typeof data.role === 'string' ? data.role : data.role?.id;

    if (!/^[a-zA-Z0-9._-]{3,64}$/.test(username)) {
      throw new BadRequestException('Логин должен содержать 3–64 символа: буквы, цифры, ., _ или -');
    }
    if (fullName.length < 2 || fullName.length > 120) throw new BadRequestException('Некорректное ФИО');
    if (password.length < 12 || password.length > 128) throw new BadRequestException('Пароль должен содержать от 12 до 128 символов');
    if (!roleId || typeof roleId !== 'string') throw new BadRequestException('Роль не указана');

    const exists = await this.prisma.user.findUnique({ where: { username }, select: { id: true } });
    if (exists) throw new ConflictException('Логин уже занят');
    const hashedPassword = await bcrypt.hash(password, 12);

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: { username, password: hashedPassword, fullName, roleId, isActive: data.isActive !== false },
        select: publicUserSelect,
      });
      if (actorId) {
        await tx.auditLog.create({
          data: {
            userId: actorId, action: 'create_user',
            field: 'user', newValue: user.username, details: `Создан пользователь ${user.fullName}`,
          },
        });
      }
      return user;
    });
  }

  async update(id: string, data: any, actorId?: string, actorName?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: publicUserSelect });
    if (!existing) throw new NotFoundException('Пользователь не найден');

    const updateData: any = {};
    if (data.username !== undefined) {
      if (typeof data.username !== 'string' || !/^[a-zA-Z0-9._-]{3,64}$/.test(data.username.trim())) {
        throw new BadRequestException('Некорректный логин');
      }
      updateData.username = data.username.trim();
    }
    if (data.fullName !== undefined) {
      if (typeof data.fullName !== 'string' || data.fullName.trim().length < 2 || data.fullName.trim().length > 120) {
        throw new BadRequestException('Некорректное ФИО');
      }
      updateData.fullName = data.fullName.trim();
    }
    if (data.isActive !== undefined) {
      if (typeof data.isActive !== 'boolean') throw new BadRequestException('isActive должен быть boolean');
      if (data.isActive === false && PROTECTED_SYSTEM_USERS.has(existing.username.toLowerCase())) {
        throw new BadRequestException('Нельзя отключить системную учётную запись');
      }
      updateData.isActive = data.isActive;
      updateData.tokenVersion = { increment: 1 };
    }
    const roleId = typeof data.roleId === 'string' ? data.roleId : typeof data.role === 'string' ? data.role : data.role?.id;
    if (roleId !== undefined) {
      if (typeof roleId !== 'string' || !roleId) throw new BadRequestException('Некорректная роль');
      updateData.roleId = roleId;
    }
    if (data.password !== undefined) {
      if (typeof data.password !== 'string' || data.password.length < 12 || data.password.length > 128) {
        throw new BadRequestException('Пароль должен содержать от 12 до 128 символов');
      }
      updateData.password = await bcrypt.hash(data.password, 12);
      updateData.tokenVersion = { increment: 1 };
    }
    if (Object.keys(updateData).length === 0) throw new BadRequestException('Нет допустимых полей для изменения');

    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.update({ where: { id }, data: updateData, select: publicUserSelect });
      if (actorId) {
        const auditFields = ['username', 'fullName', 'isActive', 'roleId'];
        for (const field of auditFields) {
          if (data[field] !== undefined && String((existing as any)[field] ?? '') !== String((user as any)[field] ?? '')) {
            await tx.auditLog.create({
              data: {
                userId: actorId, action: 'update_user', field,
                oldValue: String((existing as any)[field] ?? ''),
                newValue: String((user as any)[field] ?? ''),
                details: `Изменено поле "${field}" пользователя ${user.fullName}`,
              },
            });
          }
        }
        if (data.password !== undefined) {
          await tx.auditLog.create({
            data: { userId: actorId, action: 'reset_password', field: 'password', details: `Сменён пароль пользователя ${user.username}` },
          });
        }
      }
      return user;
    });
  }

  async remove(id: string, actorId?: string, actorName?: string) {
    const existing = await this.prisma.user.findUnique({ where: { id }, select: { id: true, username: true, fullName: true } });
    if (!existing) throw new NotFoundException('Пользователь не найден');
    if (PROTECTED_SYSTEM_USERS.has(existing.username.toLowerCase())) throw new BadRequestException('Нельзя отключить системную учётную запись');
    if (actorId === id) throw new BadRequestException('Нельзя удалить собственную учётную запись');

    return this.prisma.$transaction(async (tx) => {
      // Keep audit foreign keys valid and revoke access immediately.
      const deleted = await tx.user.update({
        where: { id },
        data: { isActive: false, tokenVersion: { increment: 1 } },
        select: publicUserSelect,
      });
      if (actorId) {
        await tx.auditLog.create({
          data: {
            userId: actorId, action: 'disable_user',
            field: 'user', oldValue: existing.username, details: `Отключён пользователь ${existing.fullName}`,
          },
        });
      }
      return deleted;
    });
  }
}
