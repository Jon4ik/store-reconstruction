const normalize=(value:unknown)=>String(value??'').normalize('NFKC').toLocaleLowerCase('ru-RU').replace(/ё/g,'е').replace(/\s+/g,' ').trim();
type TUEntry={id:string;fullName:string;isActive:boolean};
export function matchShopTU(shop:{tu?:string}|null,tus:TUEntry[]){
 const name=normalize(shop?.tu);if(!name)return '';
 const active=tus.filter(t=>t.isActive),exact=active.filter(t=>normalize(t.fullName)===name);
 if(exact.length)return exact.length===1?exact[0].id:'';
 const words=name.split(' ');
 if(words.length<2||words.length>3)return '';
 const matches=active.filter(t=>{const candidate=normalize(t.fullName).split(' ');return candidate.length>=2&&candidate.length<=3&&(words.length===2||candidate.length===2)&&words[0]===candidate[0]&&words[1]===candidate[1];});
 return matches.length===1?matches[0].id:'';
}
