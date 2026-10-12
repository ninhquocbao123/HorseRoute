import { useEffect, useRef, useState } from 'react';
import type { IUser } from '@my-project/shared';
export default function AccountMenu({account,roleName,onAccount,onLogout}:{account:IUser;roleName:string;onAccount:()=>void;onLogout:()=>void}){
 const [open,setOpen]=useState(false);
 const root=useRef<HTMLDivElement>(null),trigger=useRef<HTMLButtonElement>(null);
 useEffect(()=>{
  if(!open)return;
  const outside=(event:PointerEvent)=>{if(!root.current?.contains(event.target as Node))setOpen(false);};
  const escape=(event:KeyboardEvent)=>{if(event.key==='Escape'){setOpen(false);trigger.current?.focus();}};
  document.addEventListener('pointerdown',outside);document.addEventListener('keydown',escape);
  return()=>{document.removeEventListener('pointerdown',outside);document.removeEventListener('keydown',escape);};
 },[open]);
 return <div className="account-menu" ref={root} onBlur={event=>{if(!event.currentTarget.contains(event.relatedTarget))setOpen(false);}}>
  <button ref={trigger} type="button" className="portal-user" aria-expanded={open} aria-controls="account-options" onClick={()=>setOpen(value=>!value)}>
   <span className="portal-avatar" aria-hidden="true">{account.fullName.trim().slice(0,1)}</span><span className="account-menu-identity"><strong>{account.fullName}</strong><small>{roleName}</small></span><svg className={open?'account-chevron expanded':'account-chevron'} width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>
  </button>
  {open&&<div id="account-options" className="account-options" aria-label="Tùy chọn tài khoản">
   <button type="button" onClick={()=>{setOpen(false);onAccount();trigger.current?.focus();}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21v-2a8 8 0 0 1 16 0v2"/></svg>Tài khoản</button>
   <button type="button" className="account-logout" onClick={()=>{setOpen(false);onLogout();}}><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true"><path d="M9 4H4v16h5m5-13 5 5-5 5m-6-5h11"/></svg>Đăng xuất</button>
  </div>}
 </div>;
}
