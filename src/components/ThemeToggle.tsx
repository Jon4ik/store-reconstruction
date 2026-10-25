import React, { useState } from 'react';
import { Sun, Moon, Monitor, Check, Loader2 } from 'lucide-react';
import { useStore } from '../store/useStore';
import { apiClient } from '../api/client';
import { applyCurrentUser } from '../utils/currentUser';
const themes = [ {key:'light',label:'Светлая',icon:Sun}, {key:'dark',label:'Тёмная',icon:Moon}, {key:'system',label:'Системная',icon:Monitor} ] as const;
export default function ThemeToggle() {
  const {currentUser}=useStore();
  const [open,setOpen]=useState(false),[saving,setSaving]=useState(false),[error,setError]=useState('');
  const selected=themes.find(theme=>theme.key===currentUser?.theme) || themes[0];
  const Icon=selected.icon;
  async function choose(theme:'light'|'dark'|'system') {
    if(saving)return;
    if(theme===currentUser?.theme){setOpen(false);return;}
    const previous=currentUser?.theme || 'light';
    setSaving(true);setError('');applyCurrentUser({theme});
    try {const profile=await apiClient.updateMyProfile({theme});applyCurrentUser(profile);setOpen(false);}
    catch(e){applyCurrentUser({theme:previous});setError((e as Error).message || 'Не удалось сохранить тему');}
    finally {setSaving(false);}
  }
  return <div className="theme-picker">
    <button className="header-theme-button" type="button" title={`Тема: ${selected.label}`} aria-label="Тема оформления" aria-expanded={open} aria-controls="theme-options" onClick={()=>setOpen(!open)}>{saving ? <Loader2 size={19} className="animate-spin"/>:<Icon size={19}/>}</button>
    {open && <><button className="theme-picker-backdrop" aria-label="Закрыть выбор темы" onClick={()=>setOpen(false)}/><div className="theme-picker-menu" id="theme-options"><p>Оформление</p>{themes.map(theme=><button key={theme.key} type="button" disabled={saving} aria-pressed={selected.key===theme.key} onClick={()=>void choose(theme.key)}><theme.icon size={17}/><span>{theme.label}</span>{selected.key===theme.key && <Check size={15}/>}</button>)}{error && <small role="alert">{error}</small>}</div></>}
  </div>;
}
