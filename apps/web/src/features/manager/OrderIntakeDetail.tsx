import {vehicleNames} from '../../lib/vehicle-labels';
import {useEffect,useState} from 'react';
import {Alert,Button,Input,Modal,Select,Spin} from 'antd';
import {FileTextOutlined,BranchesOutlined,SafetyCertificateOutlined} from '@ant-design/icons';
import {useQuery} from '@tanstack/react-query';
import {getTripDetail} from '../../modules/trips/api/trips.api';
import type {OrderDetail,ReviewOptions} from '../orders/types';
import DocumentsWorkspace from '../documents/DocumentsWorkspace';
import ManagerTripPlanActions from './ManagerTripPlanActions';
import './order-intake-detail.css';

type Props={open:boolean;detail:OrderDetail|null;context:any;stageName:string;loading:boolean;error:string;actionError:string;busy:boolean;options:ReviewOptions;coordinator:string;onCoordinatorChange:(v:string)=>void;note:string;onNoteChange:(v:string)=>void;onClose:()=>void;onRetry:()=>void;onReview:(decision:string)=>void};
const date=(v?:string|null)=>v?new Date(v).toLocaleDateString('vi-VN'):'Chưa cung cấp';
const text=(v?:string|null)=>v||'Chưa cung cấp';
export default function OrderIntakeDetail(p:Props){
 const {detail:d,context:c}=p,booking=c?.booking,pending=d?.status==='PENDING';
 const [documentsOpen,setDocumentsOpen]=useState(false);
 const [tab,setTab]=useState('order');
 const [routeTarget,setRouteTarget]=useState<HTMLDivElement|null>(null);
 const tripId=c?.tripId?String(c.tripId):'';
 const tripQuery=useQuery({queryKey:['manager-trip-plan',tripId],queryFn:({signal})=>getTripDetail(tripId,signal),enabled:p.open&&!!tripId});
 const planLabel=tripQuery.data?.planStatus==='APPROVED'?'Đã duyệt':tripQuery.data?.planStatus==='PENDING_APPROVAL'?'Chờ duyệt':'Bản nháp';
 useEffect(()=>{if(p.open)setTab('order');},[p.open]);
 useEffect(()=>setDocumentsOpen(false),[d?.id,p.open]);
 const kind=d?.origin_country===d?.destination_country?'Trong nước':'Quốc tế';
 const sent=d?.created_at?new Date(d.created_at).toLocaleString('vi-VN',{hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit',year:'numeric'}):'Chưa cung cấp';
 return <><Modal rootClassName="order-intake-sheet" width={1280} centered open={p.open} onCancel={p.onClose} closable={!p.busy} maskClosable={!p.busy} keyboard={!p.busy}
  title={<div className="ois-title"><div><strong>{d?.order_code||'Chi tiết đơn'}</strong>{d&&<span>{p.stageName}</span>}</div>{d&&<p>{d.customer.full_name} · {kind} · Gửi lúc {sent}</p>}</div>}
  footer={<div className="ois-footer"><span>{pending?'Chọn điều phối viên để tiếp nhận đơn và chuyển sang thẩm định.':p.stageName}</span>{p.open&&c?.tripId&&<ManagerTripPlanActions key={c.tripId} tripId={String(c.tripId)} onUpdated={p.onRetry} contentTarget={routeTarget}/>}<Button disabled={p.busy} onClick={p.onClose}>Hủy</Button>{pending&&<Button type="primary" loading={p.busy} disabled={p.loading||!!p.error||!p.coordinator} onClick={()=>p.onReview('APPROVED')}>Tiếp nhận đơn</Button>}</div>}>
  <Spin spinning={p.loading}>{p.error&&<Alert type="error" showIcon message={p.error} action={<Button onClick={p.onRetry}>Thử lại</Button>}/>} {p.actionError&&<Alert type="error" showIcon message={p.actionError}/>}
  {d&&<div className="ois-workspace"><nav className="ois-sidebar" aria-label="Chi tiết đơn">
   <p>CHI TIẾT ĐƠN</p>
   {[
    {id:'order',title:'Thông tin đơn',icon:<FileTextOutlined/>,badge:''},
    {id:'route',title:'Lộ trình đề xuất',icon:<BranchesOutlined/>,badge:tripQuery.data?planLabel:''},
    {id:'assessment',title:'Thẩm định & giấy tờ',icon:<SafetyCertificateOutlined/>,badge:`${d.documents.filter(x=>x.status==='VALID').length}/${d.documents.length}`},
   ].map(item=><button key={item.id} type="button" aria-current={tab===item.id?'page':undefined} className={tab===item.id?'is-active':''} onClick={()=>setTab(item.id)}><span className="ois-nav-icon">{item.icon}</span><span className="ois-nav-copy"><strong>{item.title}</strong></span>{item.badge&&<span className="ois-nav-badge">{item.badge}</span>}</button>)}
  </nav><div className="ois-tab-content" key={tab}>
  <div className="ois-section-heading"><h2>{tab==='order'?'Thông tin đơn':tab==='route'?'Lộ trình đề xuất':'Thẩm định & giấy tờ'}</h2>{tab==='route'&&tripQuery.data&&<span className={`ois-plan-status ois-plan-status--${tripQuery.data.planStatus.toLowerCase()}`}>{planLabel}</span>}</div>
  {tab==='route'&&(tripId?<div ref={setRouteTarget}/>:<Alert type="info" title="Chưa có chuyến được phân công cho đơn này."/>)}
  {tab==='order'&&<><div className="ois-summary">{[
   ['Khởi hành',date(d.desired_departure_date),booking?.pickupTime||'Chưa chọn giờ đón'],
   ['Số ngựa',`${d.horses.length} ngựa`,[...new Set(d.horses.map(h=>h.breed).filter(Boolean))].join(' · ')||'Chưa cung cấp giống'],
   ['Quãng đường',booking?.distanceKm?Number(booking.distanceKm).toLocaleString('vi-VN')+' km':'Chưa cung cấp',kind],
   ['Hạng xe',(vehicleNames as Record<string,string>)[booking?.vehicleClass]||'Chưa chọn',d.special_requirements?'Có yêu cầu đặc biệt':'Không có yêu cầu đặc biệt'],
  ].map(([label,value,hint])=><div key={label}><small>{label}</small><strong>{value}</strong><span title={hint}>{hint}</span></div>)}</div>
  <div className="ois-main">
   <section className="ois-panel"><h3>Tuyến vận chuyển</h3><div className="ois-route">{[['Điểm đón',d.origin_address],['Điểm giao',d.destination_address]].map(([label,address])=><div key={label}><i/><div><small>{label}</small><p>{text(address)}</p></div></div>)}</div></section>
   <section className="ois-panel"><h3>Khách hàng</h3><div className="ois-contacts">{(['sender','recipient'] as const).map(key=><div key={key}><small>{key==='sender'?'NGƯỜI GỬI':'NGƯỜI NHẬN'}</small><strong>{text(booking?.[key]?.name||(key==='sender'?d.customer.full_name:''))}</strong><p>{text(booking?.[key]?.phone||(key==='sender'?d.customer.phone:''))} · {text(booking?.[key]?.identityNumber)}</p></div>)}</div><div className="ois-contact-footer"><span>Email: {text(d.customer.email)}</span><span>Gửi đơn: {sent}</span></div></section>
   <section className="ois-panel"><h3>Hồ sơ ngựa <span className="ois-count">{d.horses.length} ngựa</span></h3><div className="ois-horses">{d.horses.map(h=><article key={h.id}><h4>{h.name}</h4><small>Hộ chiếu: {text(h.passport_no)}</small><div className="ois-tags">{[h.breed,({MALE:'Đực',FEMALE:'Cái',GELDING:'Đực thiến',STALLION:'Đực',MARE:'Cái'} as Record<string,string>)[h.sex||'']||h.sex,h.coat_color].filter(Boolean).map((v,i)=><span key={i}>{v}</span>)}</div><p>Ngày sinh: {date(h.birth_date)}</p><p>Ghi chú: {h.note||'Không có'}</p></article>)}</div></section>
   {d.special_requirements&&<section className="ois-panel"><h3>Yêu cầu đặc biệt</h3><p className="ois-copy">{d.special_requirements}</p></section>}
  </div></>}{tab==='assessment'&&<aside className="ois-aside">
   <section className="ois-panel"><h3>{pending?'Tiếp nhận & phân công':'Kết quả tiếp nhận & thẩm định'}</h3>{pending?<><label htmlFor="ois-coordinator">Điều phối viên <em>*</em></label><Select id="ois-coordinator" aria-label="Điều phối viên" placeholder="Chọn điều phối viên phụ trách" showSearch optionFilterProp="label" value={p.coordinator||undefined} disabled={p.busy||p.loading} options={p.options.coordinators.map(x=>({value:String(x.id),label:x.full_name}))} onChange={p.onCoordinatorChange}/>{!p.loading&&!p.options.coordinators.length&&<p className="ois-warning">Chưa có điều phối viên khả dụng.</p>}<p className="ois-hint">Người được chọn sẽ phụ trách lập kế hoạch vận chuyển.</p><label htmlFor="ois-note">Ghi chú cho khách</label><Input.TextArea id="ois-note" placeholder="Nhập ghi chú hoặc nội dung cần bổ sung..." rows={4} maxLength={2000} disabled={p.busy} value={p.note} onChange={e=>p.onNoteChange(e.target.value)}/><p className="ois-hint">Sau khi tiếp nhận, chuyên viên sẽ kiểm tra hồ sơ từng ngựa.</p></>:<dl className="ois-assessment"><dt>Chuyên viên</dt><dd>{c?.assessment?.specialist_name||'Chờ chuyên viên tiếp nhận'}</dd><dt>Kết luận</dt><dd>{({IN_REVIEW:'Đang thẩm định',NEED_INFO:'Cần bổ sung',REJECTED:'Hồ sơ bị từ chối',APPROVED:'Hồ sơ hợp lệ'} as Record<string,string>)[c?.assessment?.status]||'Chưa thẩm định'}</dd><dt>Nhận xét</dt><dd>{c?.assessment?.note||d.manager_note||'Chưa có nhận xét'}</dd></dl>}</section>
   <section className="ois-panel"><h3>Giấy tờ & thẩm định</h3><p className="ois-copy">{d.documents.length?`${d.documents.filter(x=>x.status==='VALID').length}/${d.documents.length} giấy tờ đã được duyệt.`:c?.stagedDocumentCount?'Mỗi ngựa cần 3 giấy tờ: hộ chiếu, chứng nhận tiêm phòng cúm và kết quả xét nghiệm EIA (Coggins). Chuyên viên sẽ kiểm tra hồ sơ sau khi đơn được tiếp nhận.':'Khách chưa tải giấy tờ từ hồ sơ ngựa.'}</p>{d.documents.length>0&&<Button onClick={()=>setDocumentsOpen(true)}>Xem giấy tờ & kết quả</Button>}</section>
  </aside>}</div></div>}
  </Spin></Modal><Modal title={'Hồ sơ đơn '+(d?.order_code||'')} open={p.open&&documentsOpen} onCancel={()=>setDocumentsOpen(false)} footer={null} width={1100} destroyOnHidden>{d&&documentsOpen&&<DocumentsWorkspace role="MANAGER" initialOrderId={d.id}/>}</Modal></>;
}
