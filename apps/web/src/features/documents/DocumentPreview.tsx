import {useEffect,useRef,useState} from 'react';
import './document-preview.css';
export function FilePreview({file,name}:{file:Blob;name:string}){
 const [url,setUrl]=useState('');
 useEffect(()=>{const object=URL.createObjectURL(file);setUrl(object);return()=>URL.revokeObjectURL(object);},[file]);
 if(!url)return null;
 return <div className="document-preview-body">{['image/jpeg','image/png'].includes(file.type)?<img src={url} alt={'Xem trước '+name}/>:file.type==='application/pdf'?<iframe src={url} title={'Xem trước '+name}/>:<p>Định dạng này chưa hỗ trợ xem trước.</p>}</div>;
}
export default function DocumentPreview({file,name,onClose}:{file:Blob;name:string;onClose:()=>void}){
 const ref=useRef<HTMLDialogElement>(null);
 useEffect(()=>{const previous=document.activeElement as HTMLElement|null;const dialog=ref.current!;dialog.showModal();return()=>{dialog.close();previous?.focus();};},[]);
 return <dialog className="document-preview-dialog" ref={ref} aria-label="Xem tài liệu" onCancel={e=>{e.preventDefault();onClose();}}><header><div><span>TÀI LIỆU ĐÃ NỘP</span><h2>{name}</h2></div><button autoFocus type="button" onClick={onClose}>Đóng</button></header><FilePreview file={file} name={name}/></dialog>;
}
