import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Check, X, Search, ShieldCheck, LockKeyhole, Users, Loader2, AlertCircle } from 'lucide-react';
import { useStore } from '../store/useStore';
import type { Role } from '../types';
import { permissionModules } from '../config/rolePermissions';
import RolePermissions from '../components/RolePermissions';
type Draft = Pick<Role,'name'|'description'|'permissions'>;
export default function RolesPage() {
 const {roles,users,addRole,updateRole,deleteRole,hasPermission}=useStore();
 const [selectedId,setSelectedId]=useState<string|null>(null);
 const [mode,setMode]=useState<'new'|'edit'|null>(null);
 const [draft,setDraft]=useState<Draft>({name:'',description:'',permissions:[]});
 const [roleQuery,setRoleQuery]=useState('');
 const [permissionQuery,setPermissionQuery]=useState('');
 const [onlyEnabled,setOnlyEnabled]=useState(false);
 const [tab,setTab]=useState<'permissions'|'users'>('permissions');
 const [saving,setSaving]=useState(false);
 const [deleting,setDeleting]=useState(false);
 const [deleteConfirm,setDeleteConfirm]=useState(false);
 const [error,setError]=useState('');
 const [success,setSuccess]=useState('');
 const canManage=hasPermission('manage_roles');
 useEffect(()=>{if(!canManage){setMode(null);setDeleteConfirm(false);}},[canManage]);
 if(!hasPermission('view_roles')) return <div className="roles-empty"><LockKeyhole size={28}/><h3>Нет доступа к управлению ролями</h3><p>Для просмотра этой страницы требуется соответствующее разрешение.</p></div>;
 const role=roles.find(item=>item.id===selectedId) || roles[0];
 const canViewUsers=hasPermission('view_users');
 const roleUsers=role ? users.filter(user=>user.role===role.id):[];
 const current=mode ? draft:role;
 const permissions=current?.permissions || [];
 const assignedModules=permissionModules.filter(module=>module.permissions.some(permission=>permissions.includes(permission.key))).length;
 const filteredRoles=roles.filter(item=>`${item.name} ${item.description}`.toLocaleLowerCase('ru').includes(roleQuery.trim().toLocaleLowerCase('ru')));
 const begin=(target:'new'|'edit')=>{
  if(!canManage) return;
  if(target==='edit' && !role) return;
  setDraft(target==='new' ? {name:'',description:'',permissions:[]}:{name:role.name,description:role.description,permissions:[...role.permissions]});
  if(role) setSelectedId(role.id);
  setMode(target); setTab('permissions'); setPermissionQuery(''); setOnlyEnabled(false); setError(''); setSuccess(''); setDeleteConfirm(false);
 };
 const cancel=()=>{setMode(null);setError('');};
 const save=async()=>{
  if(!canManage) return;
  const name=draft.name.trim();
  if(name.length<2 || name.length>80) return setError('Название роли должно содержать от 2 до 80 символов.');
  if(roles.some(item=>item.name===name && (mode==='new' || item.id!==role?.id))) return setError('Роль с таким названием уже существует.');
  if(!draft.permissions.length) return setError('Выберите хотя бы одно разрешение.');
  setSaving(true);setError('');
  try {
   const data={...draft,name,description:draft.description.trim()};
   if(mode==='new') {await addRole({...data,isSystem:false});const added=useStore.getState().roles.find(item=>item.name===name);if(added)setSelectedId(added.id);}
   else if(role) await updateRole(role.id,data);
   setSuccess(mode==='new' ? 'Роль создана.':'Изменения роли сохранены.');setMode(null);
  } catch(e) {setError(e instanceof Error ? e.message:'Не удалось сохранить роль.');} finally {setSaving(false);}
 };
 const remove=async()=>{
  if(!canManage || !role || role.isSystem || deleting) return;
  setDeleting(true);setError('');
  try {const removed=await deleteRole(role.id);if(!removed)throw new Error('Не удалось удалить роль. Возможно, она назначена пользователям.');setSelectedId(null);setDeleteConfirm(false);setSuccess('Роль удалена.');}
  catch(e){setError(e instanceof Error ? e.message:'Не удалось удалить роль.');} finally {setDeleting(false);}
 };
 return <div className="roles-page">
  <header className="roles-page-heading"><div><span className="roles-eyebrow">Администрирование</span><h1>Роли и права доступа</h1><p>Определяйте доступ к разделам и действиям. Для действий автоматически выбирается просмотр раздела.</p></div><button className="roles-primary" onClick={()=>begin('new')} disabled={!canManage || !!mode || deleting}><Plus size={16}/>Добавить роль</button></header>
  <div className="roles-stats"><div><ShieldCheck size={18}/><span>Всего ролей<strong>{roles.length}</strong></span></div><div><LockKeyhole size={18}/><span>Системных<strong>{roles.filter(item=>item.isSystem).length}</strong></span></div><div><Users size={18}/><span>{canViewUsers ? 'Пользователей с ролью':'Управление доступом'}<strong>{canViewUsers ? users.filter(user=>roles.some(item=>item.id===user.role)).length:'По разделам'}</strong></span></div></div>
  {error && !mode && <div className="roles-notice error" role="alert"><AlertCircle size={16}/>{error}</div>}
  {success && <div className="roles-notice success" role="status"><Check size={16}/>{success}</div>}
  <div className="roles-workspace">
   <aside className="roles-directory"><div className="roles-directory-heading"><h2>Роли</h2><span>{roles.length}</span></div><label className="roles-search"><Search size={15}/><input aria-label="Поиск ролей" placeholder="Найти роль…" value={roleQuery} onChange={e=>setRoleQuery(e.target.value)}/></label>
    <div className="roles-list">{filteredRoles.map(item=>{
     const count=users.filter(user=>user.role===item.id).length;
     return <button key={item.id} className={`role-list-item ${role?.id===item.id && mode!=='new' ? 'selected':''}`} aria-pressed={role?.id===item.id && mode!=='new'} disabled={!!mode || deleting} onClick={()=>{setSelectedId(item.id);setPermissionQuery('');setDeleteConfirm(false);setError('');setSuccess('');}}>
      <span className="role-list-icon">{item.isSystem ? <LockKeyhole size={17}/>:<ShieldCheck size={17}/>}</span><span className="role-list-text"><strong>{item.name}</strong><small>{item.isSystem ? 'Системная':'Пользовательская'}{canViewUsers && ` · Пользователей: ${count}`}</small></span><span className="role-list-count" title="Количество разрешений">{new Set(item.permissions).size}</span>
     </button>;
    })}{!filteredRoles.length && <p className="roles-directory-empty">Роли не найдены</p>}</div>
    <p className="roles-directory-help">{mode ? 'Завершите редактирование или отмените изменения, чтобы выбрать другую роль.':'Выберите роль, чтобы изучить её права и назначенных пользователей.'}</p>
   </aside>
   <section className="roles-detail">
    {current ? <>
     <header className="role-detail-heading"><span className="role-detail-icon"><ShieldCheck size={23}/></span><div><span className="roles-eyebrow">{mode==='new' ? 'Новая роль':mode==='edit' ? 'Редактирование':role?.isSystem ? 'Системная роль':'Пользовательская роль'}</span><h2>{mode==='new' ? draft.name || 'Название новой роли':current.name}</h2><p>{mode ? 'Настройте название и набор разрешений.':current.description || 'Описание роли пока не добавлено.'}</p></div>{!mode && canManage && <div className="role-detail-actions"><button onClick={()=>begin('edit')} className="roles-secondary"><Edit2 size={14}/>Редактировать</button><button className="roles-icon-button" aria-label="Удалить роль" disabled={role?.isSystem || (canViewUsers && roleUsers.length>0) || deleting} title={role?.isSystem ? 'Системную роль удалить нельзя':canViewUsers && roleUsers.length ? 'Роль назначена пользователям':'Удалить роль'} onClick={()=>setDeleteConfirm(true)}><Trash2 size={16}/></button></div>}</header>
     {deleteConfirm && <div className="roles-delete-confirm"><p>Удалить роль «{role?.name}»? Это действие нельзя отменить.</p><div><button onClick={remove} disabled={deleting} className="roles-danger">{deleting ? 'Удаление…':'Удалить роль'}</button><button onClick={()=>setDeleteConfirm(false)} disabled={deleting} className="roles-secondary">Отмена</button></div></div>}
     {mode && <div className="role-identity-form"><label>Название роли <span>*</span><input value={draft.name} maxLength={80} onChange={e=>setDraft({...draft,name:e.target.value})} placeholder="Например, координатор реконструкций" disabled={saving}/></label><label>Описание<textarea rows={2} maxLength={300} value={draft.description} onChange={e=>setDraft({...draft,description:e.target.value})} placeholder="Для кого предназначена роль и какие задачи решает" disabled={saving}/></label></div>}
     <div className="role-detail-summary"><span><strong>{new Set(permissions).size}</strong> разрешений</span><span><strong>{assignedModules}</strong> разделов с правами</span>{!mode && canViewUsers && <span><strong>{roleUsers.length}</strong> пользователей</span>}{!mode && role?.isSystem && <span className="role-system-note"><LockKeyhole size={12}/>Защищена от удаления</span>}</div>
     {!mode && <div className="role-detail-tabs"><button className={tab==='permissions' ? 'active':''} onClick={()=>setTab('permissions')} aria-pressed={tab==='permissions'}>Права доступа</button><button className={tab==='users' ? 'active':''} onClick={()=>setTab('users')} aria-pressed={tab==='users'}>Пользователи{canViewUsers && <span>{roleUsers.length}</span>}</button></div>}
     {(mode || tab==='permissions') ? <>
      <div className="role-permission-toolbar"><label className="roles-search"><Search size={15}/><input aria-label="Поиск разрешений" placeholder="Найти раздел или разрешение…" value={permissionQuery} onChange={e=>setPermissionQuery(e.target.value)}/></label><label className="roles-enabled-filter"><input type="checkbox" checked={onlyEnabled} onChange={e=>setOnlyEnabled(e.target.checked)}/>Разделы с доступом</label></div>
      <fieldset disabled={saving} className="role-permission-content"><RolePermissions permissions={permissions} editable={!!mode} query={permissionQuery} onlyEnabled={onlyEnabled} onChange={next=>setDraft({...draft,permissions:next})}/></fieldset>
     </>:<div className="role-users">{!canViewUsers ? <div className="roles-empty"><LockKeyhole size={26}/><h3>Список пользователей недоступен</h3><p>Для просмотра требуется право «Просмотр пользователей».</p></div>:roleUsers.length ? roleUsers.map(user=><div className="role-user" key={user.id}><span className="role-user-avatar">{user.fullName.split(' ').filter(Boolean).slice(0,2).map(part=>part[0]).join('')}</span><div><strong>{user.fullName}</strong><small>{user.username}</small></div><span className={`role-user-status ${user.isActive ? 'active':''}`}>{user.isActive ? 'Активен':'Отключён'}</span></div>):<div className="roles-empty"><Users size={28}/><h3>Пользователей пока нет</h3><p>Эту роль ещё никому не назначили.</p></div>}</div>}
     {mode && <footer className="role-editor-footer">{error && <div className="role-editor-error" role="alert"><AlertCircle size={14}/>{error}</div>}<p><strong>{draft.permissions.length}</strong> разрешений выбрано<span>Изменения применятся после сохранения.</span></p><div><button className="roles-secondary" onClick={cancel} disabled={saving}><X size={14}/>Отмена</button><button className="roles-primary" onClick={save} disabled={saving}>{saving ? <Loader2 size={15} className="animate-spin"/>:<Check size={15}/>}{saving ? 'Сохранение…':mode==='new' ? 'Создать роль':'Сохранить изменения'}</button></div></footer>}
    </>:<div className="roles-empty"><ShieldCheck size={30}/><h3>Ролей пока нет</h3><p>Добавьте роль и настройте доступ к разделам.</p></div>}
   </section>
  </div>
 </div>;
}
