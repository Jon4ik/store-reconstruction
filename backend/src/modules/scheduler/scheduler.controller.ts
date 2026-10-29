import { BadRequestException, Body, Controller, Get, Param, Post, Put, Request, UseGuards } from '@nestjs/common';
import { SchedulerService } from './scheduler.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';

@Controller('scheduler')
@UseGuards(JwtAuthGuard, PermissionsGuard)
@RequirePermissions('manage_scheduler')
export class SchedulerController {
  constructor(private readonly schedulerService: SchedulerService) {}

  @Get('tasks')
  getTasks() { return this.schedulerService.getTasks(); }

  @Put('tasks/:id')
  updateTask(@Param('id') id: string, @Body() body: { enabled?: boolean; cronExpression?: string; exportDirectory?:string; backupFileName?:string }) {
    if (body.enabled !== undefined && typeof body.enabled !== 'boolean') throw new BadRequestException('enabled должен быть boolean');
    return this.schedulerService.updateTask(id, body);
  }

  @Post('tasks/:id/run')
  runTask(@Param('id') id: string, @Request() req) {
    if(id==='postgresql-export')return this.schedulerService.startTask(id,{id:req.user.sub,name:req.user.username});
    return this.schedulerService.runTask(id, { id: req.user.sub, name: req.user.username });
  }
}
