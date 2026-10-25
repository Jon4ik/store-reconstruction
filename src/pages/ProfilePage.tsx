import React,{useState} from 'react';
import { UserRound, ShieldCheck, KeyRound, Save, Check, AlertCircle, Eye, EyeOff, Loader2, ChevronDown } from 'lucide-react';
import {useStore} from '../store/useStore';
import {apiClient} from '../api/client';
import {applyCurrentUser} from '../utils/currentUser';
function PasswordField({label,value,onChange,autoComplete}:{label:string;value:string;onChange:(value:string)=>void;autoComplete:string}) {
  const [visible,setVisible]=useState(false);
  return <label className="profile-field">{label}<div className="profile-password-input"><input type={visible?'text':'password'} value={value} onChange={event=>onChange(event.target.value)} autoComplete={autoComplete} maxLength={128}/><button type="button" aria-label={`${visible?'Скрыть':'Показать'}: ${label}`} onClick={()=>setVisible(!visible)}>{visible?<EyeOff size={17}/>:<Eye size={17}/>}</button></div></label>;
}
export default function ProfilePage(){
  const {currentUser}=useStore();
  const [username,setUsername]=useState(currentUser?.username || ''),[fullName,setFullName]=useState(currentUser?.fullName || '');
  const [oldPassword,setOldPassword]=useState(''),[newPassword,setNewPassword]=useState(''),[confirm,setConfirm]=useState('');
  const [saving,setSaving]=useState(false),[changing,setChanging]=useState(false);
  const [error,setError]=useState(''),[success,setSuccess]=useState(''),[passwordError,setPasswordError]=useState(''),[passwordSuccess,setPasswordSuccess]=useState('');
  if(!currentUser)return null;
  const initials=currentUser.fullName.split(' ').filter(Boolean).slice(0,2).map(word=>word[0]).join('').toUpperCase() || currentUser.username[0].toUpperCase();
  const dirty=username.trim()!==currentUser.username || fullName.trim()!==currentUser.fullName;
  async function save(event:React.FormEvent){
    event.preventDefault();setError('');setSuccess('');
    if(!/^[a-zA-Z0-9._-]{3,64}$/.test(username.trim()))return setError('Логин: 3–64 символа, латинские буквы, цифры, точка, дефис или подчёркивание.');
    if(fullName.trim().length<2)return setError('Укажите имя: не менее двух символов.');
    setSaving(true);
    try{const profile=await apiClient.updateMyProfile({username:username.trim(),fullName:fullName.trim()});applyCurrentUser(profile);setUsername(profile.username);setFullName(profile.fullName);setSuccess('Изменения сохранены.');}
    catch(e){setError((e as Error).message);}finally{setSaving(false);}
  }
  async function changePassword(event:React.FormEvent){
    event.preventDefault();setPasswordError('');setPasswordSuccess('');
    if(!oldPassword || !newPassword || !confirm)return setPasswordError('Заполните все поля.');
    if(newPassword.length<12 || newPassword.length>128)return setPasswordError('Новый пароль должен содержать от 12 до 128 символов.');
    if(newPassword!==confirm)return setPasswordError('Новые пароли не совпадают.');
    setChanging(true);
    try{const result=await apiClient.changeMyPassword(oldPassword,newPassword);apiClient.setToken(result.access_token);localStorage.setItem('token',result.access_token);applyCurrentUser(result.user);setOldPassword('');setNewPassword('');setConfirm('');setPasswordSuccess('Пароль изменён.');}
    catch(e){setPasswordError((e as Error).message);}finally{setChanging(false);}
  }
  return <div className="profile-page">
    <header className="profile-page-heading"><span className="roles-eyebrow">Личный кабинет</span><h1>Мой профиль</h1><p>Личные данные и безопасность вашей учётной записи.</p></header>
    <div className="profile-layout"><aside className="profile-identity"><div className="profile-avatar">{initials}</div><h2>{currentUser.fullName}</h2><p>@{currentUser.username}</p><span className="profile-role"><ShieldCheck size={14}/>{currentUser.roleName || 'Пользователь'}</span><div className="profile-identity-foot"><span className="profile-status-dot"/>Учётная запись активна</div></aside>
    <div className="profile-sections"><section className="profile-panel"><header><span className="profile-section-icon"><UserRound size={20}/></span><div><h2>Личные данные</h2><p>Как вас видят коллеги в системе.</p></div></header>
      <form onSubmit={save}><fieldset disabled={saving}><div className="profile-form-grid"><label className="profile-field">Имя и фамилия<input value={fullName} onChange={event=>setFullName(event.target.value)} autoComplete="name" maxLength={120} placeholder="Иванов Иван Иванович" required/><small>Имя в комментариях и истории объектов.</small></label><label className="profile-field">Логин<input value={username} onChange={event=>setUsername(event.target.value)} autoComplete="username" minLength={3} maxLength={64} required/><small>Используется для входа в систему.</small></label></div></fieldset>
      {(error || success) && <p role={error?'alert':'status'} className={`profile-feedback ${error?'error':'success'}`}>{error?<AlertCircle size={16}/>:<Check size={16}/>} {error || success}</p>}
      <footer><span>{dirty?'Есть несохранённые изменения':'Данные актуальны'}</span><button className="roles-primary" disabled={!dirty || saving} type="submit">{saving?<Loader2 size={16} className="animate-spin"/>:<Save size={16}/>} {saving?'Сохранение…':'Сохранить изменения'}</button></footer></form>
    </section>
    <details className="profile-panel profile-security"><summary><span className="profile-section-icon"><KeyRound size={20}/></span><span><strong>Пароль и безопасность</strong><small>Измените пароль для входа в систему.</small></span><ChevronDown size={18}/></summary><form onSubmit={changePassword}><fieldset disabled={changing}><div className="profile-form-grid"><PasswordField label="Текущий пароль" value={oldPassword} onChange={setOldPassword} autoComplete="current-password"/><PasswordField label="Новый пароль" value={newPassword} onChange={setNewPassword} autoComplete="new-password"/><PasswordField label="Подтверждение пароля" value={confirm} onChange={setConfirm} autoComplete="new-password"/></div><p className="profile-password-hint">От 12 до 128 символов. Используйте уникальный пароль.</p></fieldset>{(passwordError || passwordSuccess) && <p role={passwordError?'alert':'status'} className={`profile-feedback ${passwordError?'error':'success'}`}>{passwordError || passwordSuccess}</p>}<footer><span>Изменение пароля завершит остальные сеансы.</span><button className="roles-secondary" type="submit" disabled={changing}>{changing?<Loader2 size={16} className="animate-spin"/>:<KeyRound size={16}/>}Изменить пароль</button></footer></form></details></div></div>
  </div>;
}
