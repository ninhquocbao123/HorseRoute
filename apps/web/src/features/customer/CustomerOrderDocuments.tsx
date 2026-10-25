import type {OrderDetail} from '../orders/types';
import { useEffect, useState } from 'react';
import { Alert, App, Button, Empty, Spin } from 'antd';
import { isAxiosError } from 'axios';
import { api } from '../../lib/axios';
import DocumentPreview, { FilePreview } from '../documents/DocumentPreview';

type Doc={id:string;horse_id:string;horse_name:string;document_name:string;status:string;invalid_reason:string|null};
type Version={document_id:string;version_no:number;attachment_id:string;original_name:string};
type Detail={documents:Doc[];versions:Version[];dossiers:{horse_id:string;status:string}[]};
const labels:Record<string,string>={NOT_SUBMITTED:'Chưa nộp',INVALID:'Cần bổ sung',EXPIRED:'Hết hạn',SUBMITTED:'Chờ thẩm định',VALID:'Đã duyệt'};
const needsFile=(d:Doc)=>['NOT_SUBMITTED','INVALID','EXPIRED'].includes(d.status);
export default function CustomerOrderDocuments({orderId,status,initialHorseId,initialDocumentId,onPendingChange,onSaved,horseDetails}:{horseDetails?:OrderDetail['horses'];orderId:string;status:string;initialHorseId?:string;initialDocumentId?:string;onPendingChange:(pending:boolean)=>void;onSaved:()=>void}) {
  const {message,modal}=App.useApp();
  const [detail,setDetail]=useState<Detail>(),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
  const [horse,setHorse]=useState(initialHorseId||''),[document,setDocument]=useState(initialDocumentId||''),[files,setFiles]=useState<Record<string,File>>({});
  const [preview,setPreview]=useState<{file:Blob;name:string}|null>(null);
  const url='/documents/orders/'+orderId;
  useEffect(()=>{let active=true;setLoading(true);api.get<Detail>(url).then(r=>{if(active){setDetail(r.data);setError('');}}).catch(()=>{if(active)setError('Không tải được giấy tờ của đơn. Vui lòng mở lại chi tiết đơn.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[url]);
  useEffect(()=>{onPendingChange(Object.keys(files).length>0||busy);return()=>onPendingChange(false);},[files,busy,onPendingChange]);
  useEffect(()=>{if(initialDocumentId&&detail){const target=detail.documents.find(d=>String(d.id)===initialDocumentId);if(target)setHorse(String(target.horse_id));}},[detail,initialDocumentId]);
  useEffect(()=>{if(detail&&(initialDocumentId||initialHorseId))window.document.getElementById('customer-order-documents')?.scrollIntoView({block:'start'});},[!!detail,initialDocumentId,initialHorseId]);
  useEffect(()=>{if(initialHorseId)setHorse(initialHorseId);},[initialHorseId]);
  const horses=Array.from(new Map((detail?.documents||[]).map(d=>[String(d.horse_id),d.horse_name])));
  const horseDocs=detail?.documents.filter(d=>String(d.horse_id)===horse)||[];
  const pendingDocs=horseDocs.filter(needsFile);
  const bundleEditable=['APPROVED','PREPARING','READY'].includes(status)&&horseDocs.some(needsFile)&&!detail?.dossiers.some(d=>String(d.horse_id)===horse&&['SUBMITTED','REVIEWING','APPROVED'].includes(d.status));
  function choose(horseId:string,documentId='') {
    const change=()=>{setHorse(horseId);setDocument(documentId);setFiles({});};
    if(Object.keys(files).length)modal.confirm({title:'Bỏ tệp chưa gửi?',content:'Bạn đã chọn tệp nhưng chưa gửi thẩm định.',okText:'Bỏ tệp',cancelText:'Tiếp tục bổ sung',onOk:change});else change();
  }
  async function upload() {
    if(!bundleEditable||!pendingDocs.length||!pendingDocs.every(d=>files[d.id])||busy)return;
    setBusy(true);
    try{const body=new FormData();for(const doc of pendingDocs)body.append('document_'+doc.id,files[doc.id]);await api.post(url+'/horses/'+horse+'/upload',body);setFiles({});setDocument('');onSaved();void message.success('Đã gửi giấy tờ bổ sung, đang chờ thẩm định.');const response=await api.get<Detail>(url);setDetail(response.data);}
    catch(e){void message.error(isAxiosError(e)?String(e.response?.data?.message||'Không tải được cập nhật. Vui lòng thử lại.'):'Không gửi được giấy tờ.');}finally{setBusy(false);}
  }
  async function view(doc:Doc){const latest=detail?.versions.filter(v=>String(v.document_id)===String(doc.id)).sort((a,b)=>b.version_no-a.version_no)[0];if(!latest)return;setBusy(true);try{const r=await api.get(url+'/files/'+latest.attachment_id,{responseType:'blob'});setPreview({file:r.data,name:latest.original_name});}catch{void message.error('Không xem được tệp. Vui lòng thử lại.');}finally{setBusy(false);}}
  return <section id="customer-order-documents" className="co-documents" style={{scrollMarginTop:24}}><h3>Ngựa & giấy tờ <span className="cod-count">{horses.length}</span></h3><p>Chỉ tải lại giấy tờ còn thiếu hoặc được yêu cầu bổ sung và gửi một lần. Giấy tờ đã duyệt hoặc đang chờ thẩm định được giữ nguyên.</p>{error&&<Alert type="error" title={error}/>}<Spin spinning={loading}>
    <div className="customer-table"><table><thead><tr><th>Ngựa</th><th>Trạng thái giấy tờ</th><th>Thao tác</th></tr></thead><tbody>{horses.map(([id,name])=>{const docs=detail!.documents.filter(d=>String(d.horse_id)===id),missing=docs.filter(needsFile),pending=docs.some(d=>d.status==='SUBMITTED');return <tr key={id} className={missing.length?'cod-needs-files':''}><td className="cod-horse-info"><strong>{name}</strong>{horseDetails?.filter(h=>String(h.id)===id).map(h=><small key={h.id}>{[h.passport_no,h.breed,h.sex,h.birth_date?'Sinh '+new Date(h.birth_date).toLocaleDateString('vi-VN'):'',h.coat_color,h.note].filter(Boolean).join(' · ')}</small>)}</td><td><span className={'cod-doc-status '+(missing.length?'missing':pending?'pending':'valid')}>{missing.length?'Cần bổ sung':pending?'Chờ thẩm định':'✓ Giấy tờ đã duyệt'}</span></td><td><Button disabled={busy} onClick={()=>choose(id,missing[0]?String(missing[0].id):'')}>{missing.length?'Bổ sung giấy tờ':'Xem'}</Button></td>{missing.length>0&&<td className="cod-missing-list"><strong>Cần bổ sung {missing.length} giấy tờ</strong><div>{missing.map(d=><span key={d.id}>{d.document_name}</span>)}</div></td>}</tr>;})}</tbody></table></div>
    {!loading&&!error&&!horses.length&&<Empty description="Checklist giấy tờ sẽ được tạo khi đơn được duyệt."/>}
    {horse&&<div className="co-document-items">{detail?.documents.filter(d=>String(d.horse_id)===horse).map(doc=>{
      const locked=detail.dossiers.some(d=>String(d.horse_id)===horse&&['SUBMITTED','REVIEWING','APPROVED'].includes(d.status));
      const editable=['APPROVED','PREPARING','READY'].includes(status)&&needsFile(doc)&&!locked;
      return <article key={doc.id} className="co-document-item"><div className="customer-heading"><h4>{doc.horse_name} · {doc.document_name}</h4><span className="customer-status">{labels[doc.status]||doc.status}</span></div>{doc.invalid_reason&&<Alert type="warning" title="Yêu cầu bổ sung" description={doc.invalid_reason}/>}
        {detail.versions.some(v=>String(v.document_id)===String(doc.id))&&<Button disabled={busy} onClick={()=>void view(doc)}>Xem tài liệu</Button>}
        {editable&&<div><label>{doc.document_name}<input key={doc.id+'-'+String(!!files[doc.id])} type="file" disabled={busy} accept="application/pdf,image/jpeg,image/png" onChange={e=>{const next=e.target.files?.[0];if(next&&(next.size>5*1024*1024||!['application/pdf','image/jpeg','image/png'].includes(next.type))){void message.error('Chọn PDF, JPG hoặc PNG, tối đa 5 MB.');e.target.value='';return;}setFiles(previous=>{const updated={...previous};if(next)updated[doc.id]=next;else delete updated[doc.id];return updated;});}}/></label>{files[doc.id]&&<><p>{files[doc.id].name}</p><FilePreview file={files[doc.id]} name={files[doc.id].name}/></>}</div>}
        {needsFile(doc)&&locked&&<p>Hồ sơ đang nộp hoặc đã được cơ quan duyệt. Chỉ bổ sung khi cơ quan yêu cầu hoặc từ chối.</p>}
      </article>;
    })}{bundleEditable&&<div className="form-actions"><span>Đã chọn {Object.keys(files).length}/{pendingDocs.length} giấy tờ cần bổ sung</span><Button type="primary" loading={busy} disabled={!pendingDocs.length||!pendingDocs.every(d=>files[d.id])} onClick={()=>void upload()}>Gửi bổ sung ({pendingDocs.length} giấy tờ)</Button><Button disabled={busy} onClick={()=>setFiles({})}>Bỏ các tệp đã chọn</Button></div>}</div>}
  </Spin>{preview&&<DocumentPreview file={preview.file} name={preview.name} onClose={()=>setPreview(null)}/>}</section>;
}
