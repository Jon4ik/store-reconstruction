import { Module } from '@nestjs/common';
import { SchedulerController } from './scheduler.controller';
import { SchedulerService } from './scheduler.service';
import { ShopsModule } from '../shops/shops.module';
import { PrismaService } from '../../prisma.service';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({ imports: [ShopsModule], controllers: [SchedulerController], providers: [SchedulerService, PrismaService, PermissionsGuard] })
export class SchedulerModule {}
