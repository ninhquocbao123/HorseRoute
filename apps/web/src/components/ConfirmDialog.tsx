import {useCallback,useEffect,useRef,useState} from 'react';
import './confirm-dialog.css';
type Options={message:string;title?:string;confirmLabel?:string;notice?:boolean};
function Dialog({options,answer}:{options:Options;answer:(value:boolean)=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current!;dialog.showModal();return()=>{dialog.close();previous?.focus();};},[]);
 return <dialog ref={ref} className="app-confirm-dialog" aria-labelledby="app-confirm-title" aria-describedby="app-confirm-message" onCancel={e=>{e.preventDefault();answer(false);}}>
  <div className="app-confirm-icon" aria-hidden="true">!</div><span className="app-confirm-caption">{options.notice?'THÔNG BÁO':'XÁC NHẬN THAO TÁC'}</span>
  <h2 id="app-confirm-title">{options.title||(options.notice?'Vui lòng kiểm tra':'Bạn muốn tiếp tục?')}</h2>
  <p id="app-confirm-message">{options.message}</p>
  <div className="app-confirm-actions">{!options.notice&&<button type="button" autoFocus onClick={()=>answer(false)}>Ở lại</button>}<button type="button" className="app-confirm-primary" autoFocus={options.notice} onClick={()=>answer(true)}>{options.confirmLabel||(options.notice?'Đã hiểu':'Tiếp tục')}</button></div>
 </dialog>;
}
export function useConfirmDialog(){
 const [options,setOptions]=useState<Options|null>(null);
 const pending=useRef<((value:boolean)=>void)|null>(null);
 const ask=useCallback((message:string,extra:Omit<Options,'message'>={})=>{
  if(pending.current)return Promise.resolve(false);
  return new Promise<boolean>(resolve=>{pending.current=resolve;setOptions({message,...extra});});
 },[]);
 const answer=useCallback((value:boolean)=>{pending.current?.(value);pending.current=null;setOptions(null);},[]);
 useEffect(()=>()=>{pending.current?.(false);pending.current=null;},[]);
 return {ask,dialog:options?<Dialog options={options} answer={answer}/>:null};
}
