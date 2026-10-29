import {Module} from '@nestjs/common';
import {PrismaService} from '../../prisma.service';
import {PermissionsGuard} from '../auth/permissions.guard';
import {VideoregsService} from './videoregs.service';
import {VideoregsController} from './videoregs.controller';
@Module({providers:[PrismaService,PermissionsGuard,VideoregsService],controllers:[VideoregsController]})
export class VideoregsModule{}
