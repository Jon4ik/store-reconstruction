import {Module} from '@nestjs/common';
import {TelegramService} from './telegram.service';
import {TelegramController} from './telegram.controller';
import {PrismaService} from '../../prisma.service';
import {PermissionsGuard} from '../auth/permissions.guard';
@Module({providers:[TelegramService,PrismaService,PermissionsGuard],controllers:[TelegramController],exports:[TelegramService]})
export class TelegramModule{}
