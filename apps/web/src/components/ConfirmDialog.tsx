import {useCallback,useEffect,useRef,useState} from 'react';
import {Modal} from 'antd';
type Options={message:string;title?:string;confirmLabel?:string;notice?:boolean};
function Dialog({options,answer}:{options:Options;answer:(value:boolean)=>void}){
 return <Modal rootClassName="app-confirm-dialog" open centered width={440} title={options.title||(options.notice?'Vui lòng kiểm tra':'Bạn muốn tiếp tục?')} okText={options.confirmLabel||(options.notice?'Đã hiểu':'Tiếp tục')} cancelText="Ở lại" cancelButtonProps={options.notice?{style:{display:'none'}}:undefined} maskClosable={false} onOk={()=>answer(true)} onCancel={()=>answer(false)}>
  <p style={{whiteSpace:'pre-line'}}>{options.message}</p>
 </Modal>;
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
