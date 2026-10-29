const assert=require('node:assert/strict');
const {of,firstValueFrom}=require('rxjs');
const {AuditInterceptor}=require('./dist/modules/audit/audit.interceptor');
const {AuditService}=require('./dist/modules/audit/audit.service');
const {StoresService}=require('./dist/modules/stores/stores.service');
const {NotificationsService}=require('./dist/modules/notifications/notifications.service');
const {extractSDRequestNumber}=require('./dist/modules/notifications/sd-request-number');
let checks=0;const check=value=>{assert.ok(value);checks++};
async function main(){
 let writes=[];
 const interceptor=new AuditInterceptor({auditLog:{create:async value=>writes.push(value)}});
 const context=path=>({switchToHttp:()=>({getRequest:()=>({method:'POST',originalUrl:path,user:{sub:'user'},body:{theme:'dark'}}),getResponse:()=>({statusCode:200})})});
 for(const path of ['/api/auth/me/profile','/api/auth/me/change-password','/api/auth/me/profile?x=1']) await firstValueFrom(interceptor.intercept(context(path),{handle:()=>of('ok')}));
 check(writes.length===0);
 await firstValueFrom(interceptor.intercept(context('/api/roles'),{handle:()=>of('ok')}));
 check(writes.length===1);check(!('userName' in writes[0].data));
 let query;
 const audit=new AuditService({auditLog:{findMany:async args=>{query=args;return [{id:'event',userId:'u',field:'project',oldValue:'',newValue:'',action:'update'}]},count:async()=>1},tU:{findMany:async()=>[]},user:{findMany:async()=>[{id:'u',fullName:'Иван Иванов'}]}});
 const result=await audit.findAll({});check(result.data[0].userName==='Иван Иванов');check(query.where.NOT.OR.some(condition=>condition.newValue.contains==='/auth/me/profile'));
 const existing={id:'p',manualStatus:'Отменено',workType:'Закрытие',stageTasks:[]};
 const stores=new StoresService({storeProject:{findFirst:async()=>existing},$transaction:()=>{throw Error('Unexpected database write')}});
 await assert.rejects(()=>stores.update('p',{stageTasks:{buyersClosed:{completed:true}}},'u','User'),error=>error.getStatus()===400);checks++;
 await assert.rejects(()=>stores.update('p',{manualStatus:null,stageTasks:{buyersClosed:{completed:true}}},'u','User'),error=>error.getStatus()===400);checks++;
 existing.manualStatus=null;
 await assert.rejects(()=>stores.update('p',{manualStatus:'Отменено',stageTasks:{buyersClosed:{completed:true}}},'u','User'),error=>error.getStatus()===400);checks++;
 const sd={completed:true,requestNumber:'SD-123',updatedAt:new Date()};let upserts=0;
 const saved=new NotificationsService({storeStageTask:{findUnique:async()=>sd,upsert:async()=>upserts++},notificationDelivery:{findFirst:async()=>null}});
 const status=await saved.getClosureRequestStatus('p');check(status.requestNumber==='SD-123'&&status.status==='sent');check(upserts===0);
 let captured;
 const legacy=new NotificationsService({storeStageTask:{findUnique:async()=>null,upsert:async args=>captured=args},notificationDelivery:{findFirst:async()=>({status:'sent',requestNumber:'SD-456'})}});
 await legacy.getClosureRequestStatus('p');check(captured.create.requestNumber==='SD-456'&&captured.update.completed);
 for(const [response,number] of [[{data:{task:{number:'SD-10',id:55}}},'SD-10'],[{Id:1,executor:{id:5},data:{TaskNumber:123}},'123'],[{TaskID:99},'99'],['SD-13','SD-13'],[null,'']]){assert.equal(extractSDRequestNumber(response),number);checks++}
 // End-to-end delivery logic uses a fake HTTP response and an in-memory transaction.
 const rule={id:'r',name:'SD test',systemTaskId:'sdRequest',channel:'intradesk',eventType:'closureDate',days:1,offsetType:'business_days',sendTime:'09:00',intradeskGroup:'1',intradeskTaskType:'2',intradeskService:'service',intradeskTags:'',intradeskSubject:'test',messageTemplate:'test'};
 let transactionWrites=[],fetches=0;
 const prisma={notificationRule:{findMany:async()=>[rule]},integrationSettings:{findUnique:async()=>({intraDeskEnabled:true,intraDeskApiGateway:'https://sd.invalid',intraDeskApiKeyEncrypted:'mock'})},storeProject:{findMany:async()=>[{id:'p',storeNumber:'1',closureDate:new Date()}]},notificationDelivery:{findUnique:async()=>null,create:async()=>({id:'delivery'})},auditLog:{create:async()=>{}},$transaction:async callback=>callback({notificationDelivery:{update:async args=>transactionWrites.push(['delivery',args.data])},storeStageTask:{upsert:async args=>transactionWrites.push(['task',args.create])}})};
 const sender=new NotificationsService(prisma);sender.decryptApiKey=()=> 'mock';sender.getMoscowDateTime=()=>({dateKey:'2026-10-24',time:'09:00'});sender.subtractDateDays=()=> '2026-10-24';sender.logger={log(){},warn(){},error(message){throw Error(message)}};
 const originalFetch=global.fetch;global.fetch=async()=>{fetches++;return {ok:true,status:200,text:async()=>JSON.stringify({metadata:'x'.repeat(5000),data:{TaskNumber:'SD-789'}})}};
 try{await sender.runDueNotifications()}finally{global.fetch=originalFetch}
 check(fetches===1);check(transactionWrites.length===2);check(transactionWrites.every(([,data])=>data.requestNumber==='SD-789'));
 console.log(`PASS: ${checks} profile/audit/manual-status/SD checks; no real SD requests or database writes`);
}
main().catch(error=>{console.error(error);process.exitCode=1});
