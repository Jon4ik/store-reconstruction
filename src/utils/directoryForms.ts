import type {SystemUser} from '../types';
export function userChanges(user:SystemUser,draft:{username:string;fullName:string;roleId:string;isActive:boolean}):Partial<SystemUser>{
 const next={username:draft.username.trim(),fullName:draft.fullName.trim(),role:draft.roleId,isActive:draft.isActive};
 return Object.fromEntries(Object.entries(next).filter(([key,value])=>user[key as keyof SystemUser]!==value));
}
export function tuPayload(draft:{fullName:string;position:string;phone:string;email:string;isActive:boolean}){
 return {...draft,fullName:draft.fullName.trim(),position:draft.position.trim(),phone:draft.phone.trim() || null,email:draft.email.trim() || null};
}
