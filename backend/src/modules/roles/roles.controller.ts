import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { RolesService } from './roles.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateRoleDto, UpdateRoleDto } from './dto/role.dto';

@Controller('roles')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class RolesController {
  constructor(private rolesService: RolesService) {}

  @Get()
  @RequirePermissions('view_roles')
  findAll() {
    return this.rolesService.findAll();
  }

  @Get('lookup')
  @RequirePermissions('manage_users')
  lookup() { return this.rolesService.lookup(); }

  @Post()
  @RequirePermissions('manage_roles')
  create(@Body() body: CreateRoleDto, @Request() req) {
    return this.rolesService.create(body, req.user.sub, req.user.username);
  }

  @Put(':id')
  @RequirePermissions('manage_roles')
  update(@Param('id') id: string, @Body() body: UpdateRoleDto, @Request() req) {
    return this.rolesService.update(id, body, req.user.sub, req.user.username);
  }

  @Delete(':id')
  @RequirePermissions('manage_roles')
  remove(@Param('id') id: string, @Request() req) {
    return this.rolesService.remove(id, req.user.sub, req.user.username);
  }
}
