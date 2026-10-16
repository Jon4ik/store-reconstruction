import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './require-permissions.decorator';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const requiredPermissions = this.reflector.getAllAndOverride<string[]>(
      PERMISSIONS_KEY,
      [context.getHandler(), context.getClass()],
    );
    // Fail closed: a guarded endpoint without explicit permission metadata is a configuration error.
    if (!requiredPermissions?.length) {
      throw new ForbiddenException('Для маршрута не настроены разрешения');
    }

    const { user } = context.switchToHttp().getRequest();
    if (!user || !Array.isArray(user.permissions)) throw new ForbiddenException('Нет доступа');

    const hasPermission = requiredPermissions.includes('delete_closures') && requiredPermissions.includes('delete_openings')
      ? requiredPermissions.some((permission) => user.permissions.includes(permission))
      : requiredPermissions.every((permission) => user.permissions.includes(permission));
    if (!hasPermission) throw new ForbiddenException('Недостаточно прав');
    return true;
  }
}
