import {BadRequestException,Injectable} from '@nestjs/common';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {mkdir,mkdtemp,chmod,chown,stat,rename,rm} from 'node:fs/promises';
import {join,isAbsolute} from 'node:path';
import {backupName,DEFAULT_BACKUP_NAME} from './backup-name';
const execute=promisify(execFile);
@Injectable()
export class DatabaseBackupService{
 async export(directory='/db_logs',fileName=DEFAULT_BACKUP_NAME){
  const name=backupName(fileName);
  if(typeof directory!=='string'||!isAbsolute(directory)||directory.includes('\0')||directory.length>500)throw new BadRequestException('Укажите абсолютную папку внутри контейнера');
  const password=process.env.DB_BACKUP_PASSWORD || '';if(password.length<12)throw new BadRequestException('Задайте DB_BACKUP_PASSWORD длиной не менее 12 символов');
  const url=new URL(process.env.DATABASE_URL || '');
  await mkdir(directory,{recursive:true,mode:0o700});const temporary=await mkdtemp(join(directory,'.backup-'));
  const dump=join(temporary,name+'.sql'),archive=join(temporary,name+'.zip');
  try{
   await execute('pg_dump',['--format=plain','--file',dump],{env:{...process.env,PGHOST:url.hostname,PGPORT:url.port||'5432',PGUSER:decodeURIComponent(url.username),PGPASSWORD:decodeURIComponent(url.password),PGDATABASE:decodeURIComponent(url.pathname.slice(1)),...(url.searchParams.get('sslmode')?{PGSSLMODE:url.searchParams.get('sslmode')!}:{})},timeout:30*60*1000,maxBuffer:1024*1024});
   await chmod(dump,0o600);
   await execute('7z',['a','-tzip','-mem=AES256','-p'+password,archive,name+'.sql'],{cwd:temporary,timeout:30*60*1000,maxBuffer:1024*1024});
   const owner=await stat(directory);await chown(archive,owner.uid,owner.gid);await chmod(archive,0o600);const output=join(directory,name+'.zip');await rename(archive,output);return {path:output,name:name+'.zip',message:'Зашифрованная копия PostgreSQL создана: '+output};
  }catch(error:any){throw new BadRequestException(error.code==='ENOENT'?'Не установлен pg_dump или 7z':'Не удалось создать резервную копию. Проверьте доступ к PostgreSQL, версию pg_dump и права на папку экспорта.');}
  finally{await rm(temporary,{recursive:true,force:true});}
 }
}
