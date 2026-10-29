import { Controller, Get, Post, Put, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { StoresService } from './stores.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';
import { AddCommentDto, CreateStoreDto, StoreQueryDto, UpdateStoreDto } from './dto/store.dto';

@Controller('stores')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class StoresController {
  constructor(private storesService: StoresService) {}

  @Get()
  @RequirePermissions('view')
  findAll(@Query() query: StoreQueryDto, @Request() req) {
    return this.storesService.findAll(query, req.user.permissions);
  }

  @Get('dashboard')
  @RequirePermissions('view_dashboard')
  getDashboard(@Request() req) {
    return this.storesService.getDashboard(req.user.permissions);
  }

  @Get(':id')
  @RequirePermissions('store:view')
  findOne(@Param('id') id: string, @Request() req) {
    return this.storesService.findOne(id, req.user.permissions);
  }

  @Post()
  @RequirePermissions('store:create')
  create(@Body() body: CreateStoreDto, @Request() req) {
    return this.storesService.create(body, req.user.sub, req.user.username);
  }

  @Put(':id')
  @RequirePermissions('store:edit')
  update(@Param('id') id: string, @Body() body: UpdateStoreDto, @Request() req) {
    return this.storesService.update(id, body, req.user.sub, req.user.username);
  }

  @Delete(':id')
  @RequirePermissions('store:delete')
  remove(@Param('id') id: string, @Request() req) {
    return this.storesService.remove(id, req.user.sub, req.user.username);
  }

  @Post(':id/restore')
  @RequirePermissions('store:delete')
  restore(@Param('id') id: string, @Request() req) {
    return this.storesService.restore(id, req.user.sub, req.user.username);
  }

  @Get(':id/comments')
  @RequirePermissions('view_comments', 'store:view')
  getComments(@Param('id') id: string) {
    return this.storesService.getComments(id);
  }

  @Post(':id/comments')
  @RequirePermissions('add_comments', 'store:view')
  addComment(@Param('id') id: string, @Body() body: AddCommentDto, @Request() req) {
    return this.storesService.addComment(id, req.user.sub, req.user.username, body.text);
  }

}
