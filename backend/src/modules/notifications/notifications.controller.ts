import { Body, Controller, Delete, Get, Param, Post, Put, UseGuards } from '@nestjs/common';
import { NotificationsService } from './notifications.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';

@Controller('notifications')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  @RequirePermissions('view_notifications')
  findAll() { return this.notifications.findAll(); }

  @Get('projects/:projectId/closure-request')
  @RequirePermissions('store:view')
  getClosureRequestStatus(@Param('projectId') projectId: string) {
    return this.notifications.getClosureRequestStatus(projectId);
  }

  @Post('projects/:projectId/closure-request/retry')
  @RequirePermissions('store:edit')
  retryClosureRequest(@Param('projectId') projectId: string) {
    return this.notifications.retryClosureRequest(projectId);
  }

  @Post()
  @RequirePermissions('create_notifications')
  create(@Body() body: any) { return this.notifications.create(body); }

  @Put(':id')
  @RequirePermissions('edit_notifications')
  update(@Param('id') id: string, @Body() body: any) { return this.notifications.update(id, body); }

  @Delete(':id')
  @RequirePermissions('delete_notifications')
  remove(@Param('id') id: string) { return this.notifications.remove(id); }
}
