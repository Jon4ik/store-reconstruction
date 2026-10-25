import { Injectable, CanActivate, ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PERMISSIONS_KEY } from './require-permissions.decorator';
import { PrismaService } from '../../prisma.service';
import { hasRight, storeRight } from './permission-model';

@Injectable()
export class PermissionsGuard implements CanActivate {
  constructor(private readonly reflector: Reflector, private readonly prisma: PrismaService) {}
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<string[]>(PERMISSIONS_KEY, [context.getHandler(), context.getClass()]);
    if (!required?.length) throw new ForbiddenException('Для маршрута не настроены разрешения');
    const req = context.switchToHttp().getRequest();
    if (!Array.isArray(req.user?.permissions)) throw new ForbiddenException('Нет доступа');
    const has = (key: string) => hasRight(req.user.permissions, key);
    for (const key of required) {
      if (key === 'lookup_tus' || key === 'lookup_shops') {
        if (has(key === 'lookup_tus' ? 'view_tus' : 'view_shops') || ['create_closures','create_openings','edit_closures','edit_openings'].some(has)) continue;
      } else if (key.startsWith('store:')) {
        const action = key.split(':')[1];
        if (action === 'create') {
          if (has(storeRight(req.body?.workType, 'create'))) continue;
        } else {
          let id = req.params.id || req.params.projectId;
          if (req.params.commentId) {
            const comment = await this.prisma.comment.findUnique({ where: { id: req.params.commentId }, select: { storeId: true } });
            if (!comment) throw new NotFoundException('Комментарий не найден');
            id = comment.storeId;
          }
          const store = await this.prisma.storeProject.findUnique({ where: { id }, select: { workType: true } });
          if (!store) throw new NotFoundException('Объект не найден');
          if (has(storeRight(store.workType, 'view')) && has(storeRight(store.workType, action)) &&
              (action !== 'edit' || !req.body?.workType || has(storeRight(req.body.workType, 'edit')))) continue;
        }
      } else if (has(key)) continue;
      throw new ForbiddenException('Недостаточно прав');
    }
    return true;
  }
}
