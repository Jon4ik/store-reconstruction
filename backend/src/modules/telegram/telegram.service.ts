import { BadRequestException, Injectable } from '@nestjs/common';
import { fetch, ProxyAgent } from 'undici';
import { PrismaService } from '../../prisma.service';
import { open, seal } from '../../utils/secret-box';
@Injectable()
export class TelegramService {
 constructor(private readonly prisma:PrismaService){}
 async settings(){const row=await this.prisma.integrationSettings.findUnique({where:{id:'default'}});let proxyAddress='';if(row?.telegramProxyUrlEncrypted){const url=new URL(open(row.telegramProxyUrlEncrypted,'LDAP_ENCRYPTION_KEY'));proxyAddress=url.origin;}
 return {enabled:row?.telegramEnabled || false,tokenConfigured:!!row?.telegramTokenEncrypted,proxyEnabled:row?.telegramProxyEnabled || false,proxyConfigured:!!row?.telegramProxyUrlEncrypted,proxyAddress};}
 async save(body:any){
  const current=await this.prisma.integrationSettings.findUnique({where:{id:'default'}});const data:any={};
  for(const [field,key] of [['enabled','telegramEnabled'],['proxyEnabled','telegramProxyEnabled']])if(body[field]!==undefined){if(typeof body[field]!=='boolean')throw new BadRequestException('Некорректный переключатель');data[key]=body[field];}
  if(body.clearToken===true)data.telegramTokenEncrypted='';else if(body.token){if(typeof body.token!=='string'||!/^\d+:[A-Za-z0-9_-]{20,}$/.test(body.token.trim()))throw new BadRequestException('Проверьте API-ключ Telegram-бота');data.telegramTokenEncrypted=seal(body.token.trim(),'LDAP_ENCRYPTION_KEY');}
  if(body.clearProxy===true)data.telegramProxyUrlEncrypted='';else if(body.proxyUrl){let url:URL;try{url=new URL(body.proxyUrl)}catch{throw new BadRequestException('Некорректный URL прокси')};if(url.protocol!=='http:'||!url.hostname||url.pathname!=='/'||url.search||url.hash)throw new BadRequestException('Используйте HTTP-прокси: http://[user:password@]host:port');data.telegramProxyUrlEncrypted=seal(url.toString(),'LDAP_ENCRYPTION_KEY');}
  if((data.telegramEnabled ?? current?.telegramEnabled)&&!(data.telegramTokenEncrypted ?? current?.telegramTokenEncrypted))throw new BadRequestException('Укажите API-ключ Telegram');
  if((data.telegramProxyEnabled ?? current?.telegramProxyEnabled)&&!(data.telegramProxyUrlEncrypted ?? current?.telegramProxyUrlEncrypted))throw new BadRequestException('Укажите HTTP-прокси');
  await this.prisma.integrationSettings.upsert({where:{id:'default'},create:{id:'default',...data},update:data});return this.settings();
 }
 async send(rule:any,text:string,settings:any){
  const token=open(settings.telegramTokenEncrypted,'LDAP_ENCRYPTION_KEY');if(!token)throw new BadRequestException('Не настроен API-ключ Telegram');
  let dispatcher:ProxyAgent|undefined;
  if(settings.telegramProxyEnabled){const proxy=new URL(open(settings.telegramProxyUrlEncrypted,'LDAP_ENCRYPTION_KEY'));const auth=proxy.username?`Basic ${Buffer.from(decodeURIComponent(proxy.username)+':'+decodeURIComponent(proxy.password)).toString('base64')}`:undefined;dispatcher=new ProxyAgent({uri:proxy.origin,...(auth?{token:auth}:{})});}
  try{
   const response=await fetch(`https://api.telegram.org/bot${token}/sendMessage`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({chat_id:rule.telegramChatId,text,...(rule.telegramThreadId&&rule.telegramTargetType==='channel'?{message_thread_id:Number(rule.telegramThreadId)}:{})}),signal:AbortSignal.timeout(30000),...(dispatcher?{dispatcher}:{})});
   const result:any=await response.json();if(!response.ok||!result.ok)throw new BadRequestException(`Telegram: ${String(result.description || 'ошибка отправки').split(token).join('[REDACTED]').slice(0,500)}`);return String(result.result?.message_id || '');
  }catch(error:any){if(error instanceof BadRequestException)throw error;throw new BadRequestException('Telegram: не удалось отправить сообщение. Проверьте подключение и HTTP-прокси.');}
  finally{if(dispatcher)await dispatcher.close();}
 }
}
