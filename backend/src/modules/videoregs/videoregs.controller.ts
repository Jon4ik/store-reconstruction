import {Body,Controller,Delete,Get,Header,Param,Post,Put,Query,Request,UploadedFile,UseGuards,UseInterceptors} from '@nestjs/common';
import {FileInterceptor} from '@nestjs/platform-express';
import {VideoregsService} from './videoregs.service';
import {JwtAuthGuard} from '../auth/jwt-auth.guard';
import {PermissionsGuard} from '../auth/permissions.guard';
import {RequirePermissions} from '../auth/require-permissions.decorator';
@Controller('videoregs') @UseGuards(JwtAuthGuard,PermissionsGuard)
export class VideoregsController{
 constructor(private readonly service:VideoregsService){}
 @Get() @RequirePermissions('view_videoregs') list(@Query('search') search='',@Query('page') page='1',@Query('limit') limit='50'){return this.service.list(search,Number(page),Number(limit))}
 @Post('import') @RequirePermissions('import_videoregs') @UseInterceptors(FileInterceptor('file',{limits:{fileSize:20*1024*1024,files:1}})) import(@UploadedFile() file:{buffer:Buffer},@Body() body:any,@Request() req){return this.service.importSqlite(file,body.legacyKey,req.user.sub,body.overwrite==='true')}
 @Get(':id/passwords') @Header('Cache-Control','no-store') @RequirePermissions('view_videoregs_passwords') passwords(@Param('id') id:string,@Request() req){return this.service.passwords(id,req.user.sub)}
 @Post() @RequirePermissions('manage_videoregs') create(@Body() body:any,@Request() req){return this.service.create(body,req.user.sub)}
 @Put(':id') @RequirePermissions('manage_videoregs') update(@Param('id') id:string,@Body() body:any,@Request() req){return this.service.update(id,body,req.user.sub)}
 @Delete(':id') @RequirePermissions('manage_videoregs') remove(@Param('id') id:string,@Request() req){return this.service.remove(id,req.user.sub)}
}
