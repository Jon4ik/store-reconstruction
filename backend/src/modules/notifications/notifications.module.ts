import {TelegramModule} from '../telegram/telegram.module';
import { Module } from '@nestjs/common';
import { NotificationsController } from './notifications.controller';
import { NotificationsService } from './notifications.service';
import { PrismaService } from '../../prisma.service';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({
  imports:[TelegramModule],
  controllers: [NotificationsController],
  providers: [NotificationsService, PrismaService, PermissionsGuard],
})
export class NotificationsModule {}
