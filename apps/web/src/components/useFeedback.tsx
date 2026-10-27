import {App} from 'antd';
import {useMemo} from 'react';
import type {ReactNode} from 'react';
const titles={success:'Thao tác thành công',error:'Không thể hoàn tất',warning:'Cần chú ý',info:'Thông tin cập nhật',loading:'Đang xử lý'};
type Kind=keyof typeof titles;
type Input=ReactNode|{content:ReactNode;key?:string|number;duration?:number;onClose?:()=>void};
/** One notification surface for all roles, including existing message callers. */
export function useFeedback(){
 const app=App.useApp();
 return useMemo(()=>{
  const show=(type:Kind,input:Input,duration?:number|(()=>void),onClose?:()=>void)=>{
   const opts=input&&typeof input==='object'&&'content' in input?input:{content:input as ReactNode};
   const key=opts.key??(typeof opts.content==='string'?`feedback:${type}:${opts.content}`:undefined);
   let resolve!:()=>void;const done=new Promise<void>(r=>{resolve=r;});
   const close=()=>{if(key!==undefined)app.notification.destroy(key);};
   app.notification.open({key,title:titles[type],description:opts.content,type:type==='loading'?'info':type,
    duration:type==='loading'||opts.duration===0||duration===0?0:type==='error'?8:4,
    placement:'topRight',className:'app-feedback',role:type==='error'?'alert':'status',
    onClose:()=>{opts.onClose?.();(typeof duration==='function'?duration:onClose)?.();resolve();}});
   return Object.assign(close,{then:done.then.bind(done),promise:done});
  };
  const message={...app.message,...Object.fromEntries(Object.keys(titles).map(type=>[type,(input:Input,duration?:number|(()=>void),close?:()=>void)=>show(type as Kind,input,duration,close)])),destroy:(key?:string)=>app.notification.destroy(key)} as typeof app.message;
  const modal={...app.modal,confirm:(options:Parameters<typeof app.modal.confirm>[0])=>app.modal.confirm({centered:true,width:440,okText:'Xác nhận',cancelText:'Quay lại',...options})};
  return {...app,message,modal};
 },[app.message,app.modal,app.notification]);
}
