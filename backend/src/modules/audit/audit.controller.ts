import { Controller, Delete, Get, Query, Request, UseGuards } from '@nestjs/common';
import { AuditService } from './audit.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { AuditQueryDto } from './dto/audit-query.dto';

@Controller('audit')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class AuditController {
  constructor(private auditService: AuditService) {}

  @Get()
  @RequirePermissions('view_audit')
  findAll(@Query() query: AuditQueryDto) {
    return this.auditService.findAll(query);
  }

  @Delete('clear')
  @RequirePermissions('clear_audit')
  clear(@Request() req) {
    return this.auditService.clear(req.user.sub, req.user.username);
  }
}
