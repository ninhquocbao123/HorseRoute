import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Modal, Slider } from 'antd';
import { api } from '../lib/axios';

export default function AvatarEditor({open,onClose,onSaved}:{open:boolean;onClose:()=>void;onSaved:(image:string)=>void}) {
 const input=useRef<HTMLInputElement>(null),canvas=useRef<HTMLCanvasElement>(null),picture=useRef<HTMLImageElement|null>(null),drag=useRef<{x:number;y:number}|null>(null);
 const request=useRef(0);
 const [loaded,setLoaded]=useState(0),[reading,setReading]=useState(false);
 const [source,setSource]=useState(''),[name,setName]=useState(''),[zoom,setZoom]=useState(1),[pos,setPos]=useState({x:0,y:0}),[preview,setPreview]=useState(''),[error,setError]=useState(''),[busy,setBusy]=useState(false);
 useEffect(()=>{if(!open){request.current++;setSource('');setName('');setPreview('');setError('');setReading(false);picture.current=null;drag.current=null;}},[open]);
 useEffect(()=>{const image=picture.current,c=canvas.current;if(!image||!c)return;const ctx=c.getContext('2d')!;const scale=Math.max(320/image.width,320/image.height)*zoom,w=image.width*scale,h=image.height*scale;const x=Math.max(-(w-320)/2,Math.min((w-320)/2,pos.x)),y=Math.max(-(h-320)/2,Math.min((h-320)/2,pos.y));ctx.fillStyle='#fff';ctx.fillRect(0,0,320,320);ctx.drawImage(image,(320-w)/2+x,(320-h)/2+y,w,h);setPreview(c.toDataURL('image/jpeg',.9));},[pos,zoom,source,loaded]);
 async function choose(file?:File){
  if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>5*1024*1024){setError('Chọn JPG, PNG hoặc WEBP tối đa 5 MB.');return;}
  const ticket=++request.current;setError('');setReading(true);setPreview('');setSource('');picture.current=null;
  try{
   const data=await new Promise<string>((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>typeof reader.result==='string'?resolve(reader.result):reject(new Error());reader.onerror=()=>reject(new Error());reader.readAsDataURL(file);});
   const image=new Image();await new Promise<void>((resolve,reject)=>{image.onload=()=>resolve();image.onerror=()=>reject(new Error());image.src=data;});
   if(ticket!==request.current)return;
   picture.current=image;setSource(data);setName(file.name);setZoom(1);setPos({x:0,y:0});setLoaded(n=>n+1);
  }catch{if(ticket===request.current)setError('Không đọc được ảnh. Vui lòng chọn ảnh khác.');}
  finally{if(ticket===request.current)setReading(false);}
 }
 async function save(){if(!canvas.current||!preview)return;setBusy(true);setError('');try{const blob=await new Promise<Blob|null>(r=>canvas.current!.toBlob(r,'image/jpeg',.9));if(!blob)throw Error();const form=new FormData();form.append('avatar',blob,'avatar.jpg');const r=await api.post('/users/me/avatar',form);onSaved(r.data.image);onClose();}catch{setError('Chưa lưu được ảnh. Vui lòng thử lại.');}finally{setBusy(false);}}
 return <Modal zIndex={1200} centered maskClosable={false} title="Đổi ảnh đại diện" open={open} onCancel={()=>!busy&&onClose()} width={560} className="avatar-editor" footer={<><Button disabled={busy} onClick={()=>input.current?.click()}>Chọn ảnh khác</Button><Button disabled={busy} onClick={onClose}>Hủy</Button><Button type="primary" disabled={!preview||reading} loading={busy} onClick={()=>void save()}>Lưu ảnh</Button></>}>
 <input ref={input} type="file" accept="image/jpeg,image/png,image/webp" hidden disabled={busy} onChange={e=>{void choose(e.target.files?.[0]);e.target.value='';}}/>
 {error&&<Alert type="error" title={error}/>}
 <div className="avatar-stage">{source?<canvas ref={canvas} width={320} height={320} aria-label="Kéo để chỉnh vị trí ảnh" onPointerDown={e=>{if(busy)return;drag.current={x:e.clientX,y:e.clientY};e.currentTarget.setPointerCapture(e.pointerId);}} onPointerMove={e=>{if(!drag.current)return;const factor=320/e.currentTarget.getBoundingClientRect().width,dx=(e.clientX-drag.current.x)*factor,dy=(e.clientY-drag.current.y)*factor;drag.current={x:e.clientX,y:e.clientY};setPos(p=>{const im=picture.current;if(!im)return p;const s=Math.max(320/im.width,320/im.height)*zoom;return {x:Math.max(-(im.width*s-320)/2,Math.min((im.width*s-320)/2,p.x+dx)),y:Math.max(-(im.height*s-320)/2,Math.min((im.height*s-320)/2,p.y+dy))};});}} onPointerUp={()=>drag.current=null} onPointerCancel={()=>drag.current=null}/>:<Button loading={reading} onClick={()=>input.current?.click()}>{reading?'Đang đọc ảnh…':'Chọn ảnh từ thiết bị'}</Button>}<p>Kéo để chỉnh vị trí ảnh</p></div>
 <div className="avatar-zoom"><Button disabled={!source||busy} onClick={()=>setZoom(z=>Math.max(1,z-.1))}>−</Button><Slider aria-label="Phóng to ảnh" min={1} max={3} step={.01} value={zoom} disabled={!source||busy} onChange={setZoom}/><Button disabled={!source||busy} onClick={()=>setZoom(z=>Math.min(3,z+.1))}>+</Button><Button disabled={busy} onClick={()=>{setZoom(1);setPos({x:0,y:0});}}>Đặt lại</Button></div>
 <div className="avatar-previews"><strong>Xem trước</strong>{preview&&[72,48,32].map(size=><img key={size} src={preview} width={size} height={size} alt={'Ảnh đại diện '+size+'px'}/>)}</div><p className="avatar-file-name">{name||'JPG, PNG, WEBP'} · Tối đa 5 MB</p>
 </Modal>;
}
