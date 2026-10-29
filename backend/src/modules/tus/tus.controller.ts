import { Controller, Get, Post, Put, Delete, Body, Param, UseGuards, Request } from '@nestjs/common';
import { TUsService } from './tus.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { CreateTUDto, UpdateTUDto } from './dto/tu.dto';

@Controller('tus')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class TUsController {
  constructor(private tusService: TUsService) {}

  @Get()
  @RequirePermissions('view_tus')
  findAll() {
    return this.tusService.findAll();
  }

  @Get('lookup')
  @RequirePermissions('lookup_tus')
  lookup() { return this.tusService.findAll(); }

  @Get(':id')
  @RequirePermissions('view_tus')
  findOne(@Param('id') id: string) {
    return this.tusService.findOne(id);
  }

  @Post()
  @RequirePermissions('manage_tus')
  create(@Body() body: CreateTUDto, @Request() req) {
    return this.tusService.create(body, req.user.sub, req.user.username);
  }

  @Put(':id')
  @RequirePermissions('manage_tus')
  update(@Param('id') id: string, @Body() body: UpdateTUDto, @Request() req) {
    return this.tusService.update(id, body, req.user.sub, req.user.username);
  }

  @Delete(':id')
  @RequirePermissions('manage_tus')
  remove(@Param('id') id: string, @Request() req) {
    return this.tusService.remove(id, req.user.sub, req.user.username);
  }
}
