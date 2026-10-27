import {useEffect,useState} from 'react';
import {Button,Modal} from 'antd';
import './document-preview.css';
export function FilePreview({file,name}:{file:Blob;name:string}){
 const [url,setUrl]=useState('');
 useEffect(()=>{const object=URL.createObjectURL(file);setUrl(object);return()=>URL.revokeObjectURL(object);},[file]);
 if(!url)return null;
 return <div className="document-preview-body">{['image/jpeg','image/png'].includes(file.type)?<img src={url} alt={'Xem trước '+name}/>:file.type==='application/pdf'?<iframe src={url} title={'Xem trước '+name}/>:<p>Định dạng này chưa hỗ trợ xem trước.</p>}</div>;
}
export default function DocumentPreview({file,name,onClose}:{file:Blob;name:string;onClose:()=>void}){
 return <Modal className="document-preview-dialog" open centered width={1000} title={name} mask={{closable:false}} onCancel={onClose} footer={<Button type="primary" onClick={onClose}>Đóng</Button>}><FilePreview file={file} name={name}/></Modal>;
}
