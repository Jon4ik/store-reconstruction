import {BadRequestException} from '@nestjs/common';
export const DEFAULT_BACKUP_NAME='db-copy{dd}.{MM}.{yyyy}';
export function backupName(template=DEFAULT_BACKUP_NAME,now=new Date()){
 if(typeof template!=='string'||!template.trim()||template.length>120)throw new BadRequestException('Укажите имя файла до 120 символов');
 const raw=template.trim().replace(/\.(zip|sql)$/i,'');
 if(!/^[\p{L}\p{N}_.{} -]+$/u.test(raw)||raw.startsWith('.')||raw.includes('..')||/[{}]/.test(raw.replace(/\{(dd|MM|yyyy)\}/g,'')))throw new BadRequestException('Имя файла: буквы, цифры, пробел, дефис, точка и шаблоны {dd}, {MM}, {yyyy}; без путей');
 const parts=new Intl.DateTimeFormat('ru-RU',{timeZone:process.env.SCHEDULER_TIMEZONE||'Europe/Moscow',day:'2-digit',month:'2-digit',year:'numeric'}).formatToParts(now);const date=Object.fromEntries(parts.map(p=>[p.type,p.value]));
 return raw.replace(/\{dd\}/g,date.day).replace(/\{MM\}/g,date.month).replace(/\{yyyy\}/g,date.year);
}
