import {Controller,Get,Put,Body,UseGuards} from '@nestjs/common';
import {TelegramService} from './telegram.service';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {PermissionsGuard} from '../auth/permissions.guard';
import {RequirePermissions} from '../auth/require-permissions.decorator';
@Controller('telegram') @UseGuards(JwtAuthGuard,PermissionsGuard) @RequirePermissions('manage_integrations')
export class TelegramController{constructor(private readonly telegram:TelegramService){} @Get('settings') get(){return this.telegram.settings()} @Put('settings') save(@Body() body:any){return this.telegram.save(body)}}
