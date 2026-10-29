import { getAuditErrorReason } from '../utils/auditError';
import React from 'react';
import { CheckCircle2, AlertCircle, ArrowRight, FileText, ChevronDown } from 'lucide-react';
import type { AuditLogEntry } from '../types';
type Props = { log: AuditLogEntry; title: string; module: string; projects: { id: string; storeNumber: string; address: string }[]; tus: { id: string; fullName: string }[] };
const labels: Record<string, string> = {
storeNumber:'Номер магазина',workType:'Тип работ',closureDate:'Закрытие для покупателей',demolitionDate:'Демонтаж',installationDate:'Монтаж',techOpenDate:'Техническое открытие',tuId:'Территориальный управляющий',comment:'Комментарий',status:'Статус',manualStatus:'Ручной статус',rowColor:'Цвет строки',stageTasks:'Задачи этапов',name:'Название',enabled:'Включено',cronExpression:'Расписание',completed:'Выполнение',requestNumber:'Номер заявки',message:'Сообщение',updatedAt:'Дата изменения',completedByUserId:'Исполнитель',completedByUserName:'Исполнитель',sdRequest:'Заявка в SD',sberApplication:'Заявка в Сбер',lakshmiApplication:'Заявка в Лакшми',buyersClosed:'Закрытие для покупателей',ukmShiftsClosed:'Закрытие смен УКМ',ukmOperationalDaysClosed:'Закрытие операционных дней УКМ',cashDelConfigured:'Конфигурация cash_del',equipmentDismantled:'Демонтаж оборудования',monitoringRemovalRequested:'Снятие с мониторинга',removedFromMailings:'Удаление из рассылок',deletedFromPrintstat:'Удаление из printstat',equipmentDelivered:'Доставка оборудования',projectCompleted:'Завершение работ',active:'Активен',deleted:'Удалён',fullName:'ФИО',isActive:'Активен',email:'Электронная почта',phone:'Телефон',position:'Должность',sendTime:'Время отправки',messageTemplate:'Текст уведомления',channel:'Канал',days:'Дней до события',eventType:'Событие',offsetType:'Способ отсчёта',intradeskGroup:'Группа IntraDesk',intradeskService:'Сервис IntraDesk',intradeskSubject:'Тема заявки',emailTo:'Получатель',emailSubject:'Тема письма',calendar_days:'Календарные дни',business_days:'Рабочие дни',intradesk:'IntraDesk',pachca:'Пачка',smtp:'Электронная почта',text:'Текст комментария',username:'Логин',theme:'Тема оформления',roleId:'Роль'
};
const colors: Record<string,string> = {'#fee2e2':'Красный','#fef3c7':'Жёлтый','#dcfce7':'Зелёный','#dbeafe':'Голубой','#f3e8ff':'Фиолетовый','#fce7f3':'Розовый'};
export default function AuditEventDetails({log,title,module,projects,tus}:Props) {
 let details: Record<string,any> = {};
 try { const value=JSON.parse(log.details || '{}'); if(value && typeof value==='object' && !Array.isArray(value)) details=value; } catch { /* Legacy plain text. */ }
 const isRequest=log.action==='api_request';
 const request=isRequest ? log.newValue || '' : '';
 const projectId=log.storeId || details.projectId || request.match(/\/stores\/([^/?\s]+)/)?.[1];
 const project=projects.find(item=>item.id===projectId);
 const code=Number(details.statusCode || 0);
 const failed=code>=400 || details.outcome==='error';
 const knownResult=code>0 || ['success','error'].includes(details.outcome);
 const isChange=!isRequest && (log.action==='update' || log.action==='change_color' || log.action.startsWith('update_'));
 const describe=(value:unknown,key='',depth=0):string=>{
  if(value===null || value===undefined || value==='') return key==='manualStatus' ? 'Автоматически' : 'Не задано';
  if(typeof value==='boolean') return key==='completed' ? value ? 'Выполнено':'Не выполнено' : value ? 'Да':'Нет';
  if(key==='stageTasks' && typeof value==='object') return Object.entries(value).map(([taskId,task])=>{
   const item=task as Record<string,unknown>;
   if(!item || typeof item!=='object') return labels[taskId] || taskId;
   const completed=item.completed===true;
   return `${labels[taskId] || 'Задача этапа'} — ${completed ? 'Выполнено':'Не выполнено'}${completed && item.completedByUserName ? `\nИсполнитель: ${item.completedByUserName}`:''}${item.updatedAt ? `\nОбновлено: ${new Date(String(item.updatedAt)).toLocaleString('ru-RU')}`:''}${item.requestNumber ? `\nНомер заявки: ${item.requestNumber}`:''}`;
  }).join('\n\n');
  if(key==='updatedAt' && typeof value==='string') return new Date(value).toLocaleString('ru-RU');
  if(typeof value==='object') return depth>2 ? 'Данные сохранены' : Object.entries(value).map(([field,item])=>`${labels[field] || field}: ${describe(item,field,depth+1)}`).join('\n');
  const text=String(value);
  if(text==='[REDACTED]') return 'Скрыто';
  if(key==='tuId') return tus.find(tu=>tu.id===text)?.fullName || (/^[a-f0-9-]{36}$/i.test(text) ? 'ТУ из справочника':text);
  if(key==='rowColor') return colors[text] || text;
  if(/Date$/.test(key) && /^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0,10).split('-').reverse().join('.');
  if(/^[a-f0-9-]{36}$/i.test(text)) return 'Запись справочника';
  return labels[text] || text;
 };
 const payload=details.payload && typeof details.payload==='object' && !Array.isArray(details.payload) ? Object.entries(details.payload):[];
 return <article className="event-detail">
  <header className="event-detail-header">
   <span className={`event-detail-icon ${failed ? 'error':''}`}>{failed ? <AlertCircle size={20}/>:<CheckCircle2 size={20}/>}</span>
   <div><span className="event-detail-eyebrow">{module}</span><h3>{title}</h3><p>{log.userName || 'Система'} <span>·</span> {new Date(log.timestamp).toLocaleString('ru-RU')}</p></div>
   <span className={`event-detail-result ${failed ? 'error':''}`}>{failed ? 'Ошибка':knownResult ? 'Успешно':'Записано'}{code>0 && <small>HTTP {code}</small>}</span>
  </header>
  {failed && isRequest && <section className="event-error-reason" role="note"><AlertCircle size={18}/><div><h4>Причина ошибки</h4><p>{getAuditErrorReason(details)}</p></div></section>}
  {(project || details.shopNumber || details.ruleName) && <div className="event-detail-context"><FileText size={16}/><div><strong>{project ? `Магазин №${project.storeNumber}`:details.shopNumber ? `Магазин №${details.shopNumber}`:String(details.ruleName)}</strong><p>{project?.address || details.ruleName || 'Событие магазина'}</p></div></div>}
  {isChange ? <section className="event-detail-section"><h4>{log.details || labels[log.field] || 'Изменение данных'}</h4><div className="event-change"><div><span>Предыдущее значение</span><p>{describe(log.oldValue,log.field)}</p></div><ArrowRight size={18}/><div><span>Новое значение</span><p>{describe(log.newValue,log.field)}</p></div></div></section>
   : !isRequest && <section className="event-detail-section"><h4>{log.action.includes('comment') ? 'Текст комментария':'Результат события'}</h4><p className="event-detail-message">{details.message || (log.action.includes('comment') ? log.newValue || log.oldValue:Object.keys(details).length ? 'Событие обработано и записано в журнал.':log.details || 'Событие записано.')}</p></section>}
  {isRequest && <section className="event-detail-section"><h4>{payload.length ? 'Переданные данные':'Результат операции'}</h4>{payload.length ? <dl className="event-payload">{payload.map(([key,value])=><div key={key}><dt>{labels[key] || key}</dt><dd>{describe(value,key)}</dd></div>)}</dl>:<p className="event-detail-message">{failed ? 'Сервер завершил запрос с ошибкой. Подробности доступны в технических данных.':'Сервер обработал запрос. Предыдущие значения в этой записи не сохранялись.'}</p>}</section>}
  <details className="event-technical"><summary>Технические данные<ChevronDown size={15}/></summary><dl>
   <div><dt>ID события</dt><dd>{log.id}</dd></div><div><dt>ID пользователя</dt><dd>{log.userId || 'Система'}</dd></div>
   {projectId && <div><dt>ID объекта</dt><dd>{projectId}</dd></div>}{log.field && <div><dt>Поле события</dt><dd>{log.field}</dd></div>}
   {request && <div><dt>Запрос</dt><dd>{request}</dd></div>}{details.ip && <div><dt>IP-адрес</dt><dd>{details.ip}</dd></div>}
   {details.userAgent && <div className="event-technical-wide"><dt>Браузер</dt><dd>{details.userAgent}</dd></div>}
  </dl>{Object.keys(details).length>0 && <pre>{JSON.stringify(details,null,2)}</pre>}</details>
 </article>;
}
