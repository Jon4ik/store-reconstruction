import { Body, Controller, Get, Post, Put, Request, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { LdapService } from './ldap.service';

@Controller('ldap')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class LdapController {
  constructor(private readonly ldapService: LdapService) {}

  @Get('settings')
  @RequirePermissions('settings')
  getSettings() { return this.ldapService.getSettings(); }

  @Put('settings')
  @RequirePermissions('settings')
  saveSettings(@Body() body: any) { return this.ldapService.saveSettings(body); }

  @Post('test')
  @RequirePermissions('settings')
  testConnection(@Body() body: { bindPassword?: string }) { return this.ldapService.testConnection(body?.bindPassword); }

  @Get('status')
  @RequirePermissions('manage_tus')
  getStatus() { return this.ldapService.getStatus(); }

  @Post('sync-tus')
  @RequirePermissions('manage_tus')
  syncTUs(@Request() req) { return this.ldapService.syncTUs(req.user.sub, req.user.username); }
}
