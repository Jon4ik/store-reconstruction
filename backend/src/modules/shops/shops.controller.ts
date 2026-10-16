import { Controller, Get, Post, Query, UseGuards, Request, BadRequestException } from '@nestjs/common';
import { ShopsService } from './shops.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { PermissionsGuard } from '../auth/permissions.guard';
import { RequirePermissions } from '../auth/require-permissions.decorator';

@Controller('shops')
@UseGuards(JwtAuthGuard, PermissionsGuard)
export class ShopsController {
  constructor(private readonly shopsService: ShopsService) {}

  @Get()
  @RequirePermissions('view_shops')
  findAll(@Query('search') search = '', @Query('limit') limit = '100') {
    const parsedLimit = Number(limit);
    if (!Number.isInteger(parsedLimit) || parsedLimit < 1 || parsedLimit > 500) throw new BadRequestException('limit должен быть от 1 до 500');
    return this.shopsService.findAll(search, parsedLimit);
  }

  @Get('lookup')
  @RequirePermissions('view_shops')
  lookup(@Query('number') number = '') {
    if (!/^\d{1,4}$/.test(number)) throw new BadRequestException('Укажите номер магазина от 1 до 4 цифр');
    return this.shopsService.lookupByNumber(number);
  }

  @Post('sync')
  @RequirePermissions('manage_shops')
  sync(@Request() req) {
    return this.shopsService.syncShops({ id: req.user.sub, name: req.user.username });
  }
}
