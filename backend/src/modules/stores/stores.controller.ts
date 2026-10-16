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
  findAll(@Query() query: StoreQueryDto) {
    return this.storesService.findAll(query);
  }

  @Get('dashboard')
  @RequirePermissions('view_dashboard')
  getDashboard() {
    return this.storesService.getDashboard();
  }

  @Get(':id')
  @RequirePermissions('view')
  findOne(@Param('id') id: string) {
    return this.storesService.findOne(id);
  }

  @Post()
  @RequirePermissions('edit')
  create(@Body() body: CreateStoreDto, @Request() req) {
    return this.storesService.create(body, req.user.sub, req.user.username);
  }

  @Put(':id')
  @RequirePermissions('edit')
  update(@Param('id') id: string, @Body() body: UpdateStoreDto, @Request() req) {
    return this.storesService.update(id, body, req.user.sub, req.user.username);
  }

  @Delete(':id')
  @RequirePermissions('delete_closures', 'delete_openings')
  remove(@Param('id') id: string, @Request() req) {
    return this.storesService.remove(id, req.user.sub, req.user.username);
  }

  @Post(':id/restore')
  @RequirePermissions('delete_closures', 'delete_openings')
  restore(@Param('id') id: string, @Request() req) {
    return this.storesService.restore(id, req.user.sub, req.user.username);
  }

  @Get(':id/comments')
  @RequirePermissions('view_comments')
  getComments(@Param('id') id: string) {
    return this.storesService.getComments(id);
  }

  @Post(':id/comments')
  @RequirePermissions('add_comments')
  addComment(@Param('id') id: string, @Body() body: AddCommentDto, @Request() req) {
    return this.storesService.addComment(id, req.user.sub, req.user.username, body.text);
  }

  @Delete('comments/:commentId')
  @RequirePermissions('delete_comments')
  deleteComment(@Param('commentId') commentId: string, @Request() req) {
    return this.storesService.deleteComment(commentId, req.user.sub, req.user.username);
  }
}
