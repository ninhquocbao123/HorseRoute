import {SearchOutlined,EnvironmentOutlined,FlagOutlined,CalendarOutlined,InfoCircleOutlined,ArrowRightOutlined} from '@ant-design/icons';
import { useState } from 'react';
import { Button, Empty, Input, Pagination } from 'antd';
import { statuses, type OrderSummary } from '../orders/types';
import './customer-orders.css';

export type CustomerOrder = OrderSummary & {quote_total:number|string|null;paid:number|string;horse_names?:string};
export const isSettledOrder = (order:CustomerOrder) => order.status==='DELIVERED' && order.quote_total!=null && Number.isFinite(Number(order.quote_total)) && Number(order.paid)>=Number(order.quote_total);
const money=(n:number|string)=>Number(n).toLocaleString('vi-VN')+'\u00A0đ';
const date=(value:string|null)=>value?new Date(value).toLocaleDateString('vi-VN'):'Chưa chọn';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/đ/g,'d').toLowerCase();

function progress(order:CustomerOrder):{step:number;label:string;hint:string} {
  if(isSettledOrder(order))return {step:8,label:'Hoàn tất',hint:'Đơn đã giao và đã thanh toán đầy đủ.'};
  switch(order.status){
    case 'DRAFT': return {step:0,label:'Bản nháp',hint:'Hoàn thiện thông tin và gửi đơn để quản lý tiếp nhận.'};
    case 'PENDING': return {step:1,label:'Gửi đơn',hint:'Đã gửi đơn, đang chờ quản lý tiếp nhận và xét duyệt.'};
    case 'NEED_INFO': return {step:1,label:'Cần bổ sung',hint:'Quản lý yêu cầu bổ sung thông tin. Mở chi tiết để xem phản hồi.'};
    case 'APPROVED': return order.quote_total==null?{step:2,label:'Đã duyệt đơn',hint:'Đơn đã được duyệt. Chưa có báo giá chính thức.'}:{step:3,label:'Báo giá',hint:'Đã có báo giá chính thức. Mở chi tiết để xem thông tin thanh toán.'};
    case 'PREPARING': return {step:4,label:'Chuẩn bị',hint:'Đơn đang được chuẩn bị cho chuyến vận chuyển.'};
    case 'READY': return {step:5,label:'Sẵn sàng',hint:'Đơn đã sẵn sàng cho chuyến vận chuyển.'};
    case 'IN_TRANSIT': return {step:6,label:'Vận chuyển',hint:'Ngựa đang được vận chuyển đến điểm giao.'};
    case 'DELIVERED': return {step:7,label:'Đã giao',hint:'Đã giao ngựa. Đơn chưa có đủ thông tin xác nhận thanh toán hoàn tất.'};
    case 'REJECTED': return {step:0,label:'Từ chối',hint:'Đơn bị từ chối. Mở chi tiết để xem lý do.'};
    case 'CANCELLED': return {step:0,label:'Đã hủy',hint:'Đơn vận chuyển đã được hủy.'};
    default: return {step:0,label:statuses[order.status]||order.status,hint:'Mở chi tiết để xem thông tin đơn.'};
  }
}

export default function CustomerOrders({orders,onOpen,onBook}:{orders:CustomerOrder[];onOpen:(id:string)=>void;onBook:()=>void}) {
  const [search,setSearch]=useState(''),[status,setStatus]=useState(''),[from,setFrom]=useState(''),[to,setTo]=useState(''),[page,setPage]=useState(1);
  const filtered=orders.filter(o=>(!status||o.status===status)&&normalize(`${o.order_code} ${o.origin_address||''} ${o.destination_address||''} ${o.horse_names||''}`).includes(normalize(search.trim()))&&(!from||!!o.desired_departure_date&&o.desired_departure_date.slice(0,10)>=from)&&(!to||!!o.desired_departure_date&&o.desired_departure_date.slice(0,10)<=to));
  const current=Math.min(page,Math.max(1,Math.ceil(filtered.length/10)));
  return <section className="customer-orders-list" aria-label="Đơn của tôi">
    <div className="customer-heading"><div><h2>Đơn của tôi</h2><p>Quản lý và theo dõi tất cả đơn vận chuyển của bạn.</p></div><Button className="customer-gold" onClick={onBook}>Đặt chuyến mới</Button></div>
    <div className="co-filters">
      <label>Tìm kiếm<Input prefix={<SearchOutlined/>} allowClear value={search} placeholder="Mã đơn, điểm đón, điểm giao, tên ngựa" onChange={e=>{setSearch(e.target.value);setPage(1);}}/></label>
      <label>Khởi hành từ<Input type="date" value={from} max={to||undefined} onChange={e=>{setFrom(e.target.value);setPage(1);}}/></label>
      <label>Đến ngày<Input type="date" value={to} min={from||undefined} onChange={e=>{setTo(e.target.value);setPage(1);}}/></label>
    </div>
    <div className="co-status-filters" aria-label="Lọc trạng thái đơn"><button type="button" aria-pressed={!status} onClick={()=>{setStatus('');setPage(1);}}>Tất cả <span>{orders.length}</span></button>{Object.entries(statuses).filter(([value])=>orders.some(o=>o.status===value)).map(([value,label])=><button type="button" key={value} aria-pressed={status===value} onClick={()=>{setStatus(value);setPage(1);}}>{label} <span>{orders.filter(o=>o.status===value).length}</span></button>)}</div>
    <div className="co-list">{filtered.slice((current-1)*10,current*10).map(order=>{
      const state=progress(order),international=order.origin_country&&order.destination_country&&order.origin_country!==order.destination_country;
      const paid=Math.max(0,Number(order.paid)||0),total=Math.max(0,Number(order.quote_total)||0),percent=total>0?Math.min(100,Math.round(paid/total*100)):0;
      const horseNames=(order.horse_names||'').split(',').map(n=>n.trim()).filter(Boolean);
      return <article className={'co-order co-status-'+order.status.toLowerCase()} key={order.id}>
        <header><div><strong>{order.order_code}</strong><span className="co-kind">{order.origin_country&&order.destination_country?(international?'Quốc tế':'Trong nước'):'Chưa chọn tuyến'}</span></div><span className={'customer-status status-'+order.status.toLowerCase()}>{statuses[order.status]||order.status}</span></header>
        <div className="co-body"><div className="co-route-stops"><div className="co-stop"><i><EnvironmentOutlined/></i><div><small>Điểm đón</small><h3>{order.origin_address||order.origin_country||'Chưa chọn điểm đón'}</h3></div></div><div className="co-stop destination"><i><FlagOutlined/></i><div><small>Điểm giao</small><h3>{order.destination_address||order.destination_country||'Chưa chọn điểm giao'}</h3></div></div></div>
          <div className="co-progress"><div className="co-progress-heading"><b>{state.step?`Bước ${state.step}/8: `:''}{state.label}</b>{state.step>0&&<small>{state.step===8?'Hoàn tất':'Còn '+(8-state.step)+' bước'}</small>}</div><div className="co-progress-segments" role="progressbar" aria-label={`Tiến độ đơn ${order.order_code}`} aria-valuemin={0} aria-valuemax={8} aria-valuenow={state.step} aria-valuetext={state.label}>{Array.from({length:8},(_,i)=><span key={i} className={i+1<state.step||state.step===8?'done':i+1===state.step?'active':''}/>)}</div></div>
        </div>
        <div className="co-facts"><div className="co-fact"><CalendarOutlined/><div><small>Khởi hành</small><strong>{date(order.desired_departure_date)}</strong></div></div><div className="co-fact"><span className="co-horse-symbol" aria-hidden="true">♘</span><div><small>Số ngựa</small><strong>{order.horse_count||0} ngựa</strong></div></div><div className="co-fact co-horse-names"><div><small>Tên ngựa</small><div>{horseNames.length?horseNames.map((name,i)=><span key={i}>{name}</span>):<span>Chưa có thông tin ngựa</span>}</div></div></div></div>
        <p className="co-hint"><InfoCircleOutlined/><span>{state.hint}</span></p>
        <footer><div className="co-payment">{order.quote_total==null?<span>Chưa có báo giá</span>:<><strong>{money(order.quote_total)}</strong><div className="co-paid"><div><small>Đã thanh toán {money(paid)}</small><small>{percent}%</small></div><progress aria-label={'Thanh toán đơn '+order.order_code} value={percent} max={100}/></div></>}</div><Button type="primary" onClick={()=>onOpen(order.id)}>Xem chi tiết <ArrowRightOutlined/></Button></footer>
      </article>;
    })}</div>
    {!filtered.length&&<Empty description={orders.length?'Không có đơn phù hợp bộ lọc.':'Bạn chưa có đơn vận chuyển.'}/>}
    <div className="co-pagination"><span>Hiển thị {filtered.length} đơn hàng</span><Pagination current={current} pageSize={10} total={filtered.length} showSizeChanger={false} onChange={setPage}/></div>
  </section>;
}
