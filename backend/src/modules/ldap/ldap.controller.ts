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
  @RequirePermissions('manage_ldap')
  getSettings() { return this.ldapService.getSettings(); }

  @Put('settings')
  @RequirePermissions('manage_ldap')
  saveSettings(@Body() body: any) { return this.ldapService.saveSettings(body); }

  @Post('test')
  @RequirePermissions('manage_ldap')
  testConnection(@Body() body: { url?: string; baseDN?: string; bindDN?: string; bindPassword?: string }) { return this.ldapService.testConnection(body); }

  @Get('integrations/intradesk')
  @RequirePermissions('manage_integrations')
  getIntegrationSettings() { return this.ldapService.getIntegrationSettings(); }

  @Put('integrations/intradesk')
  @RequirePermissions('manage_integrations')
  saveIntegrationSettings(@Body() body: any) { return this.ldapService.saveIntegrationSettings(body); }

  @Get('status')
  @RequirePermissions('manage_tus')
  getStatus() { return this.ldapService.getStatus(); }

  @Post('sync-tus')
  @RequirePermissions('manage_tus')
  syncTUs(@Request() req) { return this.ldapService.syncTUs(req.user.sub, req.user.username); }
}
