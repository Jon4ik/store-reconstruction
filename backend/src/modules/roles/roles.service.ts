import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

const ALLOWED_PERMISSIONS = new Set([
  'view', 'edit', 'view_closures', 'create_closures', 'edit_closures', 'delete_closures',
  'view_openings', 'create_openings', 'edit_openings', 'delete_openings', 'view_calendar',
  'view_dashboard', 'import', 'export', 'view_comments', 'add_comments', 'delete_comments',
  'view_users', 'manage_users', 'view_roles', 'manage_roles', 'view_tus', 'manage_tus',
  'view_audit', 'clear_audit', 'settings', 'manage_ldap', 'manage_integrations', 'manage_notifications', 'view_shops', 'manage_shops', 'manage_scheduler', 'delete_closures', 'delete_openings',
]);

@Injectable()
export class RolesService {
  constructor(private prisma: PrismaService) {}

  findAll() {
    return this.prisma.role.findMany({ orderBy: { createdAt: 'asc' } });
  }

  private validate(data: any, partial = false) {
    const clean: any = {};
    if (!partial || data.name !== undefined) {
      if (typeof data.name !== 'string' || data.name.trim().length < 2 || data.name.trim().length > 80) throw new BadRequestException('Название роли должно содержать 2–80 символов');
      clean.name = data.name.trim();
    }
    if (data.description !== undefined) {
      if (typeof data.description !== 'string' || data.description.length > 300) throw new BadRequestException('Описание роли слишком длинное');
      clean.description = data.description.trim();
    }
    if (!partial || data.permissions !== undefined) {
      if (!Array.isArray(data.permissions) || data.permissions.length > ALLOWED_PERMISSIONS.size ||
          data.permissions.some((permission: unknown) => typeof permission !== 'string' || !ALLOWED_PERMISSIONS.has(permission))) {
        throw new BadRequestException('Список разрешений содержит недопустимые значения');
      }
      clean.permissions = [...new Set(data.permissions)];
    }
    // isSystem is intentionally not client-editable.
    return clean;
  }

  async create(data: any, userId?: string, userName?: string) {
    const clean = this.validate(data);
    const duplicate = await this.prisma.role.findUnique({ where: { name: clean.name }, select: { id: true } });
    if (duplicate) throw new ConflictException('Роль с таким названием уже существует');
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.create({ data: clean });
      if (userId) await tx.auditLog.create({
        data: { userId, userName: userName || 'Система', action: 'create_role', field: 'role', newValue: role.name, details: `Создана роль ${role.name}` },
      });
      return role;
    });
  }

  async update(id: string, data: any, userId?: string, userName?: string) {
    const existing = await this.prisma.role.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Роль не найдена');
    const clean = this.validate(data, true);
    if (!Object.keys(clean).length) throw new BadRequestException('Нет допустимых полей для изменения');
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.update({ where: { id }, data: clean });
      if (userId) {
        for (const field of Object.keys(clean)) {
          await tx.auditLog.create({
            data: {
              userId, userName: userName || 'Система', action: 'update_role', field,
              oldValue: String((existing as any)[field] ?? ''),
              newValue: Array.isArray((role as any)[field]) ? (role as any)[field].join(',') : String((role as any)[field] ?? ''),
              details: `Изменено поле "${field}" роли ${role.name}`,
            },
          });
        }
      }
      return role;
    });
  }

  async remove(id: string, userId?: string, userName?: string) {
    const existing = await this.prisma.role.findUnique({ where: { id }, include: { users: { select: { id: true } } } });
    if (!existing) throw new NotFoundException('Роль не найдена');
    if (existing.isSystem) throw new BadRequestException('Системную роль удалить нельзя');
    if (existing.users.length) throw new BadRequestException('Нельзя удалить роль, назначенную пользователям');
    return this.prisma.$transaction(async (tx) => {
      const role = await tx.role.delete({ where: { id } });
      if (userId) await tx.auditLog.create({
        data: { userId, userName: userName || 'Система', action: 'delete_role', field: 'role', oldValue: existing.name, details: `Удалена роль ${existing.name}` },
      });
      return role;
    });
  }
}
