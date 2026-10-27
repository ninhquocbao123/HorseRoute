import {api} from '../../lib/axios';
import {useState, useCallback} from 'react';
import {Alert,Button} from 'antd';
import {statuses,type OrderDetail} from '../orders/types';
import CustomerQuote from '../manager/CustomerQuote';
import CustomerOrderDocuments from './CustomerOrderDocuments';
import {useOrderSocket} from '../../lib/socket';
import './customer-order-detail.css';

type Props={detail:OrderDetail;initialHorseId?:string;initialDocumentId?:string;onPendingChange:(pending:boolean)=>void;onSaved:()=>void;onBack:()=>void};

export default function CustomerOrderDetail({detail,...p}:Props){
 const [d,setDetail]=useState(detail);
 const [horse,setHorse]=useState(p.initialHorseId);
 const missing=d.documents.filter(doc=>['NOT_SUBMITTED','INVALID','EXPIRED'].includes(doc.status));
 const names=[...new Set(missing.map(doc=>doc.horse_name))];

 const refreshDetail = useCallback(() => {
   void api.get('/orders/'+d.id).then(r=>setDetail(r.data)).catch(()=>{});
 }, [d.id]);

 useOrderSocket(d.id, {
   onPaymentUpdate: () => {
     refreshDetail();
     p.onSaved();
   },
   onStatusUpdate: () => {
     refreshDetail();
     p.onSaved();
   },
   onReconnect: () => {
     refreshDetail();
   },
 });

 return <section className="customer-order-detail cod-detail"><Button type="text" onClick={p.onBack}>← Quay lại danh sách</Button><header className="cod-header"><div><h2>{d.order_code}</h2><span className="customer-status">{statuses[d.status]||d.status}</span></div><p>Khách hàng: <strong>{d.customer.full_name}</strong> · {d.customer.email}{d.customer.phone&&' · '+d.customer.phone}</p></header><div className="cod-layout"><main className="cod-main">
 {names.length>0&&d.status!=='REJECTED'&&<Alert type="warning" showIcon title={names.length+' ngựa cần bổ sung giấy tờ'} description={names.map(name=>name+' thiếu '+missing.filter(doc=>doc.horse_name===name).length+' giấy tờ').join('; ')+'. Kết quả của các ngựa khác được giữ nguyên.'} action={<Button onClick={()=>{setHorse(d.horses.find(h=>h.name===names[0])?.id);document.getElementById('customer-order-documents')?.scrollIntoView({behavior:'smooth',block:'start'});}}>Bổ sung ngay</Button>}/>}
 {d.manager_note&&<Alert type={d.status==='REJECTED'?'error':'info'} showIcon title={d.status==='REJECTED'?'Đơn hàng bị từ chối':'Phản hồi quản lý'} description={d.manager_note}/>}
 <section className="cod-card cod-itinerary"><h3>Hành trình</h3><div className="cod-route"><div><small>Điểm đi</small><p>{d.origin_address} ({d.origin_country})</p></div><div><small>Điểm đến</small><p>{d.destination_address} ({d.destination_country})</p></div></div><footer><span>Khởi hành <strong>{d.desired_departure_date?new Date(d.desired_departure_date).toLocaleDateString('vi-VN'):'Chưa chọn'}</strong></span><span>{d.horses.length} ngựa</span></footer>{d.special_requirements&&<p>{d.special_requirements}</p>}</section>
 <section className="cod-card"><CustomerOrderDocuments orderId={d.id} status={d.status} horseDetails={d.horses} initialHorseId={horse} initialDocumentId={p.initialDocumentId} onPendingChange={p.onPendingChange} onSaved={()=>{p.onSaved();refreshDetail();}}/></section>
 <details className="cod-card cod-history"><summary>Lịch sử xử lý</summary>{d.history.length?d.history.map(h=><p key={h.id}><strong>{h.actor_name}</strong> · {new Date(h.occurred_at).toLocaleString('vi-VN')}<br/>{h.reason||({SUBMIT:'Gửi đơn',REVIEW:'Xét duyệt đơn',CREATE:'Tạo đơn',UPDATE:'Cập nhật đơn',REJECT:'Từ chối đơn'} as Record<string,string>)[h.action]||h.action}</p>):<p>Chưa có lịch sử xử lý.</p>}</details>
 </main><aside className="cod-quote"><CustomerQuote orderId={d.id} orderCode={d.order_code} orderStatus={d.status} onPaymentSuccess={()=>{refreshDetail();p.onSaved();}}/></aside></div></section>;
}
