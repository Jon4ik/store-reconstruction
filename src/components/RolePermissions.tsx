import { toggleRight, permissionDependencies } from '../utils/permissions';
import React from 'react';
import { Check, Minus, ShieldCheck } from 'lucide-react';
import { permissionModules } from '../config/rolePermissions';
type Props = { permissions:string[]; editable:boolean; query:string; onlyEnabled:boolean; onChange:(permissions:string[])=>void };
export default function RolePermissions({permissions,editable,query,onlyEnabled,onChange}:Props) {
 const known=new Set(permissionModules.flatMap(module=>module.permissions.map(permission=>permission.key)));
 const extra=permissions.filter(permission=>!known.has(permission));
 const modules=extra.length ? [...permissionModules,{name:'Дополнительные разрешения',key:'additional',permissions:extra.map(key=>({key,label:key}))}]:permissionModules;
 const needle=query.trim().toLocaleLowerCase('ru');
 const matching=modules.map(module=>({...module,permissions:module.name.toLocaleLowerCase('ru').includes(needle) ? module.permissions:module.permissions.filter(permission=>`${permission.label} ${permission.key}`.toLocaleLowerCase('ru').includes(needle))})).filter(module=>module.permissions.length && (!onlyEnabled || module.permissions.some(permission=>permissions.includes(permission.key))));
 if(!matching.length) return <div className="roles-empty"><ShieldCheck size={28}/><h3>Разрешения не найдены</h3><p>Измените поиск или покажите все разделы.</p></div>;
 return <div className="permission-matrix">{matching.map(module=>{
  const allowed=module.permissions.filter(permission=>permissions.includes(permission.key)).length;
  const selected=allowed===module.permissions.length;
  return <section key={module.key} className="permission-module">
   <header><div>{editable ? <input type="checkbox" aria-label={`Все права: ${module.name}`} checked={selected} ref={node=>{if(node) node.indeterminate=allowed>0 && !selected;}} onChange={()=>onChange(module.permissions.reduce((next, permission) => next.includes(permission.key) === selected ? toggleRight(next, permission.key) : next, permissions))}/>:<span className={`permission-module-icon ${allowed ? 'allowed':''}`}><ShieldCheck size={16}/></span>}<h3>{module.name}</h3></div><span>{allowed} / {module.permissions.length}</span></header>
   <div className="permission-options">{module.permissions.map(permission=>{
    const enabled=permissions.includes(permission.key);
    return <label key={permission.key} className={`permission-option ${enabled ? 'enabled':''} ${editable ? 'editable':''}`} title={permissionDependencies[permission.key] ? `${permission.key} · Требуется просмотр раздела` : permission.key}>
     {editable ? <input type="checkbox" checked={enabled} onChange={()=>onChange(toggleRight(permissions, permission.key))}/>:enabled ? <Check size={15}/>:<Minus size={15}/>}
     <span>{permission.label}</span>{!editable && <small>{enabled ? 'Разрешено':'Нет доступа'}</small>}
    </label>;
   })}</div>
  </section>;
 })}</div>;
}
