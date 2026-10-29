import React,{useEffect,useState} from 'react';
import {Plus,Edit2,RefreshCw,UserX} from 'lucide-react';
import {useStore} from '../store/useStore';
import {apiClient} from '../api/client';
import {validateEmail} from '../utils/validation';
import {tuPayload} from '../utils/directoryForms';
import PhoneInput from '../components/PhoneInput';
import DirectoryWorkspace,{DetailHeader,InfoGrid,Notice,EditorFooter,EmptyDetail} from '../components/DirectoryWorkspace';
type Draft={fullName:string;position:string;phone:string;email:string;isActive:boolean};
const blank:Draft={fullName:'',position:'Территориальный управляющий',phone:'',email:'',isActive:true};
export default function TUsPage(){
 const {tus,projects,loadTUs,loadAuditLog,deleteTU,hasPermission,openCard}=useStore();
 const [query,setQuery]=useState('');const [status,setStatus]=useState('');const [selectedId,setSelectedId]=useState('');
 const [mode,setMode]=useState<'new'|'edit'|null>(null);const [draft,setDraft]=useState<Draft>(blank);const [saving,setSaving]=useState(false);
 const [error,setError]=useState('');const [message,setMessage]=useState('');const [confirmDisable,setConfirmDisable]=useState(false);
 const [ldap,setLdap]=useState(false);const [syncing,setSyncing]=useState(false);const [tab,setTab]=useState<'info'|'projects'>('info');
 const canManage=hasPermission('manage_tus');const canView=hasPermission('view_tus');
 useEffect(()=>{if(!canManage)return;let active=true;apiClient.getLdapStatus().then(result=>{if(active)setLdap(result.configured);}).catch(()=>{});return()=>{active=false;};},[canManage]);
 const matches=tus.filter(tu=>(!status || String(tu.isActive)===status) && `${tu.fullName} ${tu.position} ${tu.phone || ''} ${tu.email || ''}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
 const tu=mode==='edit' ? tus.find(item=>item.id===selectedId):matches.find(item=>item.id===selectedId) || matches[0];
 const linked=projects.filter(project=>project.tuId===tu?.id && !project.isDeleted);
 const begin=(next:'new'|'edit')=>{if(next==='edit' && !tu)return;setSelectedId(tu?.id || '');setDraft(next==='new' ? {...blank}:{fullName:tu!.fullName,position:tu!.position,phone:tu!.phone || '',email:tu!.email || '',isActive:tu!.isActive});setMode(next);setError('');setMessage('');setConfirmDisable(false);};
 const save=async()=>{
  if(!canManage || saving)return;
  if(draft.fullName.trim().length<2)return setError('Укажите ФИО: не менее двух символов.');
  if(!validateEmail(draft.email.trim()))return setError('Укажите корректный email.');
  if(draft.phone && !/^[+0-9() .-]{5,40}$/.test(draft.phone.trim()))return setError('Проверьте номер телефона.');
  setSaving(true);setError('');
  try{const data=tuPayload(draft);
   if(mode==='new'){const added=await apiClient.createTU(data);setSelectedId(added.id);setQuery('');setStatus('');}else if(tu)await apiClient.updateTU(tu.id,data);
   await Promise.all([loadTUs(),loadAuditLog()]);setMode(null);setTab('info');setMessage(mode==='new' ? 'ТУ добавлен в справочник.':'Данные ТУ сохранены.');
  }catch(e){setError((e as Error).message);}finally{setSaving(false);}
 };
 const sync=async()=>{if(!canManage || syncing)return;setSyncing(true);setError('');setMessage('');try{const result=await apiClient.syncTUsFromAD();await Promise.all([loadTUs(),loadAuditLog()]);setMessage(`Синхронизация завершена. Найдено: ${result.found}, добавлено: ${result.created}, обновлено: ${result.updated}, отключено: ${result.disabled}, пропущено: ${result.skipped}.`);}catch(e){setError((e as Error).message);}finally{setSyncing(false);}};
 const disable=async()=>{if(!tu || !canManage || saving)return;setSaving(true);setError('');try{if(!await deleteTU(tu.id))throw new Error('Не удалось отключить ТУ. Проверьте связанные события.');setConfirmDisable(false);setMessage('ТУ отключён. История событий сохранена.');}catch(e){setError((e as Error).message);}finally{setSaving(false);}};
 if(!canView && !canManage)return <div className="roles-empty">Нет доступа к справочнику ТУ</div>;
 return <DirectoryWorkspace title="Справочник ТУ" eyebrow="Справочники" description="Контакты управляющих и связанные события магазинов." query={query} onQuery={setQuery} searchLabel="Поиск ТУ и контактов" selectedId={mode==='new' ? undefined:tu?.id} locked={!!mode || saving || syncing} onSelect={id=>{setSelectedId(id);setTab('info');setConfirmDisable(false);setError('');setMessage('');}} items={matches.map(item=>({id:item.id,title:item.fullName,subtitle:item.position,badge:item.isActive ? 'Активен':'Отключён',active:item.isActive}))} stats={[{label:'Всего ТУ',value:tus.length},{label:'Активных',value:tus.filter(item=>item.isActive).length},{label:'С контактами',value:tus.filter(item=>item.phone || item.email).length}]} actions={canManage && <><button className="roles-secondary" onClick={sync} disabled={!ldap || syncing || !!mode || saving} title={ldap ? 'Синхронизировать с Active Directory':'Подключите LDAP в настройках'}><RefreshCw size={15} className={syncing ? 'animate-spin':''}/>{syncing ? 'Синхронизация…':'Синхронизировать с AD'}</button><button className="roles-primary" onClick={()=>begin('new')} disabled={!!mode || saving || syncing}><Plus size={16}/>Добавить ТУ</button></>} filter={<select aria-label="Статус ТУ" value={status} disabled={!!mode || saving || syncing} onChange={e=>setStatus(e.target.value)}><option value="">Все статусы</option><option value="true">Активные</option><option value="false">Отключённые</option></select>}>
  {!mode && <Notice error={!!error} message={error || message}/>}
  {mode ? <><DetailHeader title={mode==='new' ? 'Новый ТУ':'Редактирование ТУ'} subtitle="Контактные данные и доступность для назначения на события." eyebrow="Территориальный управляющий"/>
   <fieldset disabled={saving} className="directory-form"><label>ФИО *<input maxLength={120} value={draft.fullName} onChange={e=>setDraft({...draft,fullName:e.target.value})}/></label><label>Должность<input maxLength={120} value={draft.position} onChange={e=>setDraft({...draft,position:e.target.value})}/></label><label>Телефон<PhoneInput value={draft.phone} onChange={value=>setDraft({...draft,phone:value})}/></label><label>Email<input type="email" maxLength={254} value={draft.email} onChange={e=>setDraft({...draft,email:e.target.value})}/></label><label>Статус<select value={String(draft.isActive)} onChange={e=>setDraft({...draft,isActive:e.target.value==='true'})}><option value="true">Активен</option><option value="false">Отключён</option></select></label></fieldset>
   <EditorFooter saving={saving} error={error} onCancel={()=>{setMode(null);setError('');}} onSave={save} label={mode==='new' ? 'Добавить ТУ':'Сохранить изменения'}/></>
  :tu ? <><DetailHeader title={tu.fullName} subtitle={tu.position || 'Должность не указана'} eyebrow="Территориальный управляющий" actions={canManage && <><button className="roles-secondary" onClick={()=>begin('edit')} disabled={saving || syncing}><Edit2 size={14}/>Редактировать</button><button className="roles-icon-button" aria-label="Отключить ТУ" title={linked.length ? 'ТУ назначен на события':!tu.isActive ? 'ТУ уже отключён':'Отключить ТУ'} disabled={saving || syncing || !tu.isActive || linked.length>0} onClick={()=>setConfirmDisable(true)}><UserX size={16}/></button></>}/>
   {confirmDisable && <div className="roles-delete-confirm"><p>Отключить ТУ «{tu.fullName}»? Запись и история сохранятся.</p><div><button className="roles-danger" disabled={saving} onClick={disable}>Отключить ТУ</button><button className="roles-secondary" disabled={saving} onClick={()=>setConfirmDisable(false)}>Отмена</button></div></div>}
   <div className="role-detail-tabs"><button className={tab==='info' ? 'active':''} aria-pressed={tab==='info'} onClick={()=>setTab('info')}>Контакты и сведения</button><button className={tab==='projects' ? 'active':''} aria-pressed={tab==='projects'} onClick={()=>{setTab('projects');void useStore.getState().loadProjects();}}>Связанные события <span>{linked.length}</span></button></div>
   {tab==='info' ? <><InfoGrid items={[{label:'Статус',value:<span className={tu.isActive ? 'directory-status-on':'directory-status-off'}>{tu.isActive ? 'Активен':'Отключён'}</span>},{label:'Источник записи',value:'adObjectGuid' in tu && tu.adObjectGuid ? 'Active Directory':'Локальный справочник'},{label:'Телефон',value:tu.phone ? <a href={`tel:${tu.phone}`}>{tu.phone}</a>:'Не указан'},{label:'Email',value:tu.email ? <a href={`mailto:${tu.email}`}>{tu.email}</a>:'Не указан'}]}/><section className="directory-section"><h3>Назначение на события</h3><p>{tu.isActive ? 'Управляющий доступен для выбора при создании и редактировании события.':'Управляющий не доступен для новых назначений. История событий сохраняется.'}</p><div className="directory-inline-facts"><span><strong>{linked.length}</strong> связанных событий в текущем списке</span></div></section></>
   :<section className="directory-section"><h3>Связанные события</h3>{linked.length ? linked.map(project=><button key={project.id} className="directory-event" onClick={()=>openCard(project.id)}><span><strong>Магазин №{project.storeNumber}</strong><small>{project.address}</small></span><span>{project.workType}<small>{project.status}</small></span></button>):<p>В доступном списке нет событий, назначенных этому ТУ.</p>}</section>}
  </>:<EmptyDetail message="Измените поиск или добавьте ТУ."/>}
 </DirectoryWorkspace>;
}
