import React,{useEffect} from 'react';
import {createPortal} from 'react-dom';
import {CheckCircle2,AlertCircle,X} from 'lucide-react';
export type CopyNotice={message:string;error:boolean;id:number};
export default function CopyToast({notice,onClose}:{notice:CopyNotice|null;onClose:()=>void}){
 useEffect(()=>{if(!notice)return;const timer=setTimeout(onClose,notice.error?8000:6000);return()=>clearTimeout(timer)},[notice,onClose]);
 if(!notice)return null;
 return createPortal(<div className={`copy-toast ${notice.error?'error':'success'}`} role={notice.error?'alert':'status'} aria-live={notice.error?'assertive':'polite'} aria-atomic="true">{notice.error?<AlertCircle size={24}/>:<CheckCircle2 size={24}/>}<div><strong>{notice.error?'Не удалось скопировать пароль':'Пароль скопирован'}</strong><p>{notice.message}</p></div><button type="button" onClick={onClose} aria-label="Закрыть уведомление"><X size={18}/></button></div>,document.body);
}
