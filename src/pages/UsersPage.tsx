import React,{useState} from 'react';
import {Plus,Edit2,Trash2,KeyRound,ShieldCheck} from 'lucide-react';
import {useStore} from '../store/useStore';
import {userChanges} from '../utils/directoryForms';
import DirectoryWorkspace,{DetailHeader,InfoGrid,Notice,EditorFooter,EmptyDetail} from '../components/DirectoryWorkspace';
type Draft={username:string;fullName:string;roleId:string;isActive:boolean;password:string;confirm:string};
const blank:Draft={username:'',fullName:'',roleId:'',isActive:true,password:'',confirm:''};
export default function UsersPage(){
 const {users,roles,currentUser,hasPermission,addUser,updateUser,deleteUser}=useStore();
 const [selectedId,setSelectedId]=useState('');const [query,setQuery]=useState('');const [status,setStatus]=useState('');
 const [mode,setMode]=useState<'new'|'edit'|'password'|null>(null);const [draft,setDraft]=useState<Draft>(blank);
 const [saving,setSaving]=useState(false);const [error,setError]=useState('');const [message,setMessage]=useState('');const [confirmDelete,setConfirmDelete]=useState(false);
 const canManage=hasPermission('manage_users');
 const roleName=(id:string)=>roles.find(role=>role.id===id)?.name || users.find(user=>user.role===id)?.roleName || 'Роль не указана';
 const matches=users.filter(user=>(!status || String(user.isActive)===status) && `${user.fullName} ${user.username} ${roleName(user.role)}`.toLocaleLowerCase('ru').includes(query.trim().toLocaleLowerCase('ru')));
 const user=mode && mode!=='new' ? users.find(item=>item.id===selectedId):matches.find(item=>item.id===selectedId) || matches[0];
 const role=roles.find(item=>item.id===user?.role);
 const begin=(next:'new'|'edit'|'password')=>{if(next!=='new' && !user)return;setSelectedId(user?.id || '');setDraft(next==='new' ? {...blank}:{...blank,username:user!.username,fullName:user!.fullName,roleId:user!.role,isActive:user!.isActive});setMode(next);setError('');setMessage('');setConfirmDelete(false);};
 const save=async()=>{
  if(!canManage || saving)return;
  if(mode==='password' || mode==='new'){
   if(draft.password.length<12 || draft.password.length>128)return setError('Пароль должен содержать от 12 до 128 символов.');
   if(mode==='password' && draft.password!==draft.confirm)return setError('Пароли не совпадают.');
  }
  if(mode!=='password'){
   if(!/^[a-zA-Z0-9._-]{3,64}$/.test(draft.username.trim()))return setError('Логин: 3–64 символа, латинские буквы, цифры, точка, дефис или подчёркивание.');
   if(draft.fullName.trim().length<2)return setError('Укажите ФИО: не менее двух символов.');
   if(!draft.roleId)return setError('Выберите роль пользователя.');
   if(users.some(item=>item.username===draft.username.trim() && (mode==='new' || item.id!==user?.id)))return setError('Пользователь с таким логином уже существует.');
  }
  setSaving(true);setError('');
  try{
   if(mode==='new') {await addUser({username:draft.username.trim(),fullName:draft.fullName.trim(),role:draft.roleId,password:draft.password,isActive:draft.isActive});setQuery('');setStatus('');setSelectedId(useStore.getState().users.find(item=>item.username===draft.username.trim())?.id || '');}
   else if(user){
    const data:Partial<typeof user>=mode==='password' ? {password:draft.password}:userChanges(user,draft);
    if(Object.keys(data).length)await updateUser(user.id,data);
   }
   setMessage(mode==='password' ? 'Пароль изменён.':mode==='new' ? 'Пользователь создан.':'Данные пользователя сохранены.');setMode(null);setDraft({...blank});
  }catch(e){setError(e instanceof Error ? e.message:'Не удалось сохранить пользователя.');}finally{setSaving(false);}
 };
 const remove=async()=>{if(!user || !canManage || user.id===currentUser?.id || saving)return;setSaving(true);setError('');try{if(!await deleteUser(user.id))throw new Error('Не удалось удалить пользователя.');setConfirmDelete(false);setSelectedId('');setMessage('Пользователь удалён.');}catch(e){setError((e as Error).message);}finally{setSaving(false);}};
 if(!hasPermission('view_users') && !canManage)return <div className="roles-empty">Нет доступа к пользователям</div>;
 const protectedUser=!!user && ['admin','manager','viewer'].includes(user.username.toLowerCase());
 return <DirectoryWorkspace title="Пользователи системы" eyebrow="Администрирование" description="Учётные записи, роли и доступ сотрудников." query={query} onQuery={setQuery} searchLabel="Поиск пользователей" locked={!!mode || saving} selectedId={mode==='new' ? undefined:user?.id} onSelect={id=>{setSelectedId(id);setError('');setMessage('');setConfirmDelete(false);}} items={matches.map(item=>({id:item.id,title:item.fullName,subtitle:`${item.username} · ${roleName(item.role)}`,badge:item.isActive ? 'Активен':'Отключён',active:item.isActive}))} stats={[{label:'Всего пользователей',value:users.length},{label:'Активных',value:users.filter(item=>item.isActive).length},{label:'Используется ролей',value:new Set(users.map(item=>item.role)).size}]} actions={canManage && <button className="roles-primary" disabled={!!mode || saving} onClick={()=>begin('new')}><Plus size={16}/>Добавить пользователя</button>} filter={<select aria-label="Статус пользователей" value={status} disabled={!!mode || saving} onChange={e=>setStatus(e.target.value)}><option value="">Все статусы</option><option value="true">Активные</option><option value="false">Отключённые</option></select>}>
  {!mode && <Notice error={!!error} message={error || message}/>}
  {mode ? <><DetailHeader title={mode==='new' ? 'Новый пользователь':mode==='password' ? 'Изменение пароля':'Редактирование пользователя'} subtitle={mode==='password' ? draft.fullName:'Настройте учётную запись и роль сотрудника.'} eyebrow="Учётная запись"/>
   <fieldset disabled={saving} className="directory-form">
    {mode!=='password' && <><label>Логин *<input value={draft.username} maxLength={64} onChange={e=>setDraft({...draft,username:e.target.value})} autoComplete="off"/></label><label>ФИО *<input value={draft.fullName} maxLength={120} onChange={e=>setDraft({...draft,fullName:e.target.value})}/></label><label>Роль *<select value={draft.roleId} onChange={e=>setDraft({...draft,roleId:e.target.value})}><option value="">Не выбрана</option>{draft.roleId && !roles.some(item=>item.id===draft.roleId) && <option value={draft.roleId}>{roleName(draft.roleId)}</option>}{roles.map(item=><option key={item.id} value={item.id}>{item.name}</option>)}</select></label><label>Статус<select value={String(draft.isActive)} disabled={mode==='edit' && protectedUser} onChange={e=>setDraft({...draft,isActive:e.target.value==='true'})}><option value="true">Активен</option><option value="false">Отключён</option></select></label></>}
    {(mode==='new' || mode==='password') && <label>{mode==='new' ? 'Пароль *':'Новый пароль *'}<input type="password" autoComplete="new-password" minLength={12} maxLength={128} value={draft.password} onChange={e=>setDraft({...draft,password:e.target.value})}/><small>От 12 до 128 символов</small></label>}
    {mode==='password' && <label>Повторите пароль *<input type="password" autoComplete="new-password" maxLength={128} value={draft.confirm} onChange={e=>setDraft({...draft,confirm:e.target.value})}/></label>}
   </fieldset><EditorFooter saving={saving} error={error} onCancel={()=>{setMode(null);setDraft({...blank});setError('');}} onSave={save} label={mode==='new' ? 'Создать пользователя':mode==='password' ? 'Изменить пароль':'Сохранить изменения'}/></>
  :user ? <><DetailHeader title={user.fullName} subtitle={user.username} eyebrow={user.id===currentUser?.id ? 'Ваша учётная запись':'Учётная запись'} actions={canManage && <><button className="roles-secondary" onClick={()=>begin('edit')} disabled={saving}><Edit2 size={14}/>Редактировать</button><button className="roles-icon-button" aria-label="Изменить пароль" title="Изменить пароль" onClick={()=>begin('password')} disabled={saving}><KeyRound size={16}/></button><button className="roles-icon-button" aria-label="Удалить пользователя" title={protectedUser ? 'Системная учётная запись':user.id===currentUser?.id ? 'Нельзя удалить себя':'Удалить пользователя'} onClick={()=>setConfirmDelete(true)} disabled={saving || protectedUser || user.id===currentUser?.id}><Trash2 size={16}/></button></>}/>
   {confirmDelete && <div className="roles-delete-confirm"><p>Удалить пользователя «{user.fullName}»?</p><div><button className="roles-danger" disabled={saving} onClick={remove}>Удалить пользователя</button><button className="roles-secondary" disabled={saving} onClick={()=>setConfirmDelete(false)}>Отмена</button></div></div>}
   <InfoGrid items={[{label:'Статус',value:<span className={user.isActive ? 'directory-status-on':'directory-status-off'}>{user.isActive ? 'Активен':'Отключён'}</span>},{label:'Роль',value:roleName(user.role)},{label:'Логин',value:user.username},{label:'Дата регистрации',value:new Date(user.createdAt).toLocaleDateString('ru-RU')}]}/>
   <section className="directory-section"><h3><ShieldCheck size={16}/>Доступ по роли</h3><p>{role?.description || 'Разрешения определяются назначенной ролью.'}</p>{role && <div className="directory-inline-facts"><span><strong>{role.permissions.length}</strong> разрешений</span><span>{role.isSystem ? 'Системная роль':'Пользовательская роль'}</span></div>}</section>
  </>:<EmptyDetail message="Измените поиск или добавьте пользователя."/>}
 </DirectoryWorkspace>;
}
