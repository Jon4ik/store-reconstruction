export async function copyText(text:string){
 if(navigator.clipboard?.writeText){try{await navigator.clipboard.writeText(text);return;}catch{}}
 const previous=document.activeElement as HTMLElement|null;const field=document.createElement('textarea');field.value=text;field.readOnly=true;field.style.cssText='position:fixed;left:-9999px;top:0;opacity:0';document.body.appendChild(field);
 try{field.focus();field.select();if(!document.execCommand('copy'))throw new Error('Браузер не разрешил копирование пароля');}finally{field.value='';field.remove();previous?.focus({preventScroll:true});}
}
