import { Module } from '@nestjs/common';
import { ShopsController } from './shops.controller';
import { ShopsService } from './shops.service';
import { PrismaService } from '../../prisma.service';
import { PermissionsGuard } from '../auth/permissions.guard';

@Module({ controllers: [ShopsController], providers: [ShopsService, PrismaService, PermissionsGuard], exports: [ShopsService] })
export class ShopsModule {}
