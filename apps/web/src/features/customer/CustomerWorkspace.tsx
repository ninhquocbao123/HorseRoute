import LandingPage from '../home/LandingPage';
import AccountProfile from '../../components/AccountProfile';
import {useFeedback} from '../../components/useFeedback';
import CustomerOrders, { isSettledOrder } from './CustomerOrders';
import BrandLogo from '../../components/BrandLogo';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Alert, App, Button, ConfigProvider, Empty, Input, Pagination, Select, Spin, Tabs, Tag } from 'antd';
import { BellOutlined, LogoutOutlined, HeartOutlined, SafetyCertificateOutlined, FileTextOutlined, CarOutlined } from '@ant-design/icons';
import type { DashboardProps } from '../auth/pages/components/DashboardLayout';
import { api } from '../../lib/axios';
import OrdersWorkspace from '../orders/OrdersWorkspace';
import CustomerJourney, { RouteDrawing } from './CustomerJourney';
import TrackingWorkspace from '../tracking/TrackingWorkspace';
import NotificationsPanel, { type Notice } from '../notifications/NotificationsPanel';
import { statuses, type OrderSummary } from '../orders/types';
import './customer.css';
import './journey.css';

type CustomerOrder=OrderSummary&{quote_total:number|string|null;paid:number|string;horse_names?:string};
type Horse={id:string;order_id:string;name:string;passport_no:string;breed:string|null;birth_date:string|null;sex:string|null;coat_color:string|null;note:string|null;order_code:string;order_status:string;document_count:number;missing_documents:number;pending_documents:number};
type CustomerReceipt = {
  id: string | number;
  order_id: string | number;
  order_code: string;
  quote_id: string | number;
  amount: number | string;
  method: string;
  source: string;
  reference: string;
  received_at: string;
};
type Workspace = { orders: CustomerOrder[]; horses: Horse[]; receipts?: CustomerReceipt[] };
const paymentMethods: Record<string, string> = {
  BANK_TRANSFER: 'Chuyển khoản QR',
  E_WALLET: 'Ví điện tử',
  CARD: 'Thẻ quốc tế',
  MANUAL: 'Thủ công',
  CASH: 'Tiền mặt',
};
const navigation=[['overview','Trang chủ'],['horses','Hồ sơ ngựa'],['booking','Đặt chuyến'],['orders','Đơn của tôi'],['history','Lịch sử giao dịch']];
const money=(n:number|string)=>Number(n).toLocaleString('vi-VN')+'\u00A0đ';
const date=(v:string|null|undefined)=>v?new Date(v).toLocaleDateString('vi-VN'):'Chưa chọn';
function Status({value}:{value:string}){return <span className={'customer-status status-'+value.toLowerCase()}>● {statuses[value]||value}</span>;}
export default function CustomerWorkspace({account,logout}:DashboardProps){
 const navigate=useNavigate(),[params]=useSearchParams(),{message,modal}=useFeedback();
 const requested=params.get('view')==='documents'?'horses':params.get('view')||'overview',view=[...navigation.map(n=>n[0]),'tracking','notifications','account','confirm'].includes(requested)?requested:'overview';
 const title=navigation.find(n=>n[0]===view)?.[1]||({confirm:'Xác nhận đơn hàng',tracking:'Theo dõi hành trình',notifications:'Thông báo',account:'Tài khoản'} as Record<string,string>)[view];
 const [data,setData]=useState<Workspace>({orders:[],horses:[]}),[loading,setLoading]=useState(true),[error,setError]=useState('');
 const [notices,setNotices]=useState<Notice[]>([]),[noticeError,setNoticeError]=useState(''),[unread,setUnread]=useState(false),[marking,setMarking]=useState<string|null>(null);
 const guard=useRef<(()=>Promise<boolean>)|null>(null),register=useCallback((fn:(()=>Promise<boolean>)|null)=>{guard.current=fn;},[]);
 const refresh=useCallback(async()=>{setLoading(true);try{const {data:next}=await api.get<Workspace>('/orders/customer-workspace');setData(next);setError('');}catch{setError('Không tải được thông tin của bạn. Vui lòng thử lại.');}finally{setLoading(false);}},[]);
 const refreshNotices=useCallback(async()=>{try{const {data:items}=await api.get<Notice[]>('/notifications');setNotices(items);setNoticeError('');}catch{setNoticeError('Không tải được thông báo.');}},[]);
 useEffect(()=>{void refresh();void refreshNotices();},[refresh,refreshNotices,view]);
 async function go(next:string,id?:string,horse?:string,document?:string){if(guard.current&&!await guard.current())return;navigate('/dashboard?view='+next+(id?'&order='+encodeURIComponent(id):'')+(horse?'&horse='+encodeURIComponent(horse):'')+(document?'&document='+encodeURIComponent(document):''));window.scrollTo(0,0);}
 async function markRead(id:string){setMarking(id);try{await api.post('/notifications/'+id+'/read');setNotices(items=>items.map(n=>n.id===id?{...n,is_read:1}:n));}catch{void message.error('Chưa thể cập nhật thông báo.');}finally{setMarking(null);}}
 const needs=data.orders.filter(o=>o.status==='NEED_INFO'),running=data.orders.filter(o=>o.status==='IN_TRANSIT');
 const missing=data.horses.filter(h=>Number(h.missing_documents)>0),ready=data.horses.filter(h=>Number(h.document_count)>0&&!Number(h.missing_documents)&&!Number(h.pending_documents));
 return <ConfigProvider theme={{token:{fontFamily:"Be Vietnam Pro, sans-serif",fontSize:13,colorPrimary:"#0c3e47",borderRadius:8}}}><div className={'customer'+(['horses','booking'].includes(view)?' hp-page':'')}><header className="customer-nav"><button className="customer-brand" onClick={()=>void go('overview')}><BrandLogo /><strong>Vận chuyển ngựa</strong></button><nav aria-label="Điều hướng khách hàng">{navigation.map(([id,label])=><button key={id} className={view===id?'active':''} aria-current={view===id?'page':undefined} onClick={()=>void go(id)}>{label}</button>)}</nav><div className="customer-user"><button aria-label="Thông báo" onClick={()=>void go('notifications')} className="customer-bell"><BellOutlined/>{notices.some(n=>!n.is_read)&&<i/>}</button><AccountProfile account={account} roleName="Khách hàng"/><button className="customer-logout" title="Đăng xuất khỏi tài khoản" aria-label="Đăng xuất" onClick={async()=>{if(guard.current&&!await guard.current())return;modal.confirm({title:'Đăng xuất khỏi tài khoản?',okText:'Đăng xuất',cancelText:'Ở lại',onOk:logout});}}><LogoutOutlined/><span>Đăng xuất</span></button></div></header>
 {view==='overview'?<section className="customer-hero"><div><span className="customer-pill">Xe chuyên dụng 2 – 9 ngăn</span><h1>Vận chuyển ngựa đua<br/><em>Việt Nam · Trung Quốc · Thailand</em></h1><p>Xe nguyên chuyến chỉ chở ngựa của bạn, mỗi xe có tài xế và nhân viên chăm sóc riêng. Theo dõi tiến độ hành trình ngay trong tài khoản.</p><Button className="customer-gold" onClick={()=>void go('booking')}>Đặt chuyến ngay</Button></div></section>:<section className="customer-banner"><div><small>Trang chủ / {title}</small><h1>{title}</h1><p>{view==='horses'?'Lập hồ sơ cho từng con ngựa trước khi đặt chuyến.':view==='history'?'Lịch sử các giao dịch đặt cọc, thanh toán và các đơn hàng liên quan.':view==='booking'?'Chuyến trong nước và quốc tế giữa các kho, trại và câu lạc bộ.':view==='orders'?'Quản lý đơn vận chuyển, báo giá và giấy tờ của từng ngựa.':view==='confirm'?'Kiểm tra thông tin chuyến trước khi gửi.':'Theo dõi và quản lý hành trình của bạn.'}</p></div></section>}
 <main className={'customer-main customer-'+view}>
 {error&&<Alert type="error" showIcon title={error} action={<Button onClick={()=>void refresh()}>Thử lại</Button>}/>}
 {view==='overview'&&<Spin spinning={loading}><div className="customer-welcome"><span className="customer-pill">♡ Xin chào, {account.fullName}</span><div><Button className="customer-gold" onClick={()=>void go('booking')}>+ Đặt chuyến mới</Button><Button onClick={()=>void go('horses')}>Hồ sơ ngựa</Button></div></div><div className="customer-stats">{[[<BellOutlined/>,needs.length+missing.length,'Việc cần bổ sung'],[<SafetyCertificateOutlined/>,data.orders.filter(o=>o.status==='PENDING').length,'Đơn chờ duyệt'],[<HeartOutlined/>,ready.length,'Ngựa đủ giấy tờ'],[<FileTextOutlined/>,missing.length,'Ngựa cần bổ sung giấy']].map(([icon,count,label],i)=><article key={String(label)}><i className={'tone-'+i}>{icon}</i><div><strong>{error?'—':count}</strong><span>{label}</span></div></article>)}</div><div className="customer-home-grid"><section className="customer-card"><div className="customer-heading"><h2><BellOutlined/> Việc cần làm</h2><button onClick={()=>void go('orders')}>Tất cả đơn →</button></div>{needs.map(o=><div className="customer-task" key={o.id}><FileTextOutlined/><div><b>Bổ sung thông tin đơn {o.order_code}</b><small>Đọc phản hồi của quản lý và gửi lại yêu cầu.</small></div><Button onClick={()=>void go('orders',o.id)}>Bổ sung</Button></div>)}{missing.slice(0,4).map(h=><div className="customer-task" key={h.id}><SafetyCertificateOutlined/><div><b>Bổ sung giấy tờ cho {h.name}</b><small>{h.order_code} · {h.missing_documents} giấy tờ cần xử lý</small></div><Button className="customer-gold" onClick={()=>void go('orders',h.order_id,h.id)}>Bổ sung giấy tờ</Button></div>)}{data.orders.filter(o=>o.quote_total!==null&&Number(o.paid)<Number(o.quote_total)).slice(0,3).map(o=><div className="customer-task" key={'quote'+o.id}><FileTextOutlined/><div><b>Báo giá đơn {o.order_code}</b><small>{money(o.quote_total!)} · Đã thu {money(o.paid)}</small></div><Button type="primary" onClick={()=>void go('orders',o.id)}>Xem báo giá</Button></div>)}{!needs.length&&!missing.length&&!data.orders.some(o=>o.quote_total!==null&&Number(o.paid)<Number(o.quote_total))&&<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Bạn chưa có việc cần xử lý"/>}</section><section className="customer-card"><div className="customer-heading"><h2>Chuyến đang chạy</h2><CarOutlined/></div>{running.length?running.slice(0,2).map(o=><div className="customer-running" key={o.id}><Status value={o.status}/><h3>{o.order_code}</h3><RouteDrawing from={o.origin_address||o.origin_country||''} to={o.destination_address||o.destination_country||''}/><p>{o.horse_count||0} ngựa · Khởi hành {date(o.desired_departure_date)}</p></div>):<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description="Chưa có chuyến đang vận chuyển"/>}<Button block onClick={()=>void go('tracking')}>Theo dõi hành trình</Button></section></div></Spin>}
 {view==='overview'&&<LandingPage embedded/>}
 <CustomerJourney view={view} orderId={params.get('order')||undefined} account={account} go={go} register={register} onSaved={()=>{void refresh();void refreshNotices();}}/>
 {view==='orders'&&!params.get('order')&&<Spin spinning={loading}><CustomerOrders orders={data.orders} onOpen={id=>void go('orders',id)} onBook={()=>void go('booking')}/></Spin>}
 {view==='orders'&&params.get('order')&&<OrdersWorkspace key={params.get('order')} role="CUSTOMER" onBack={()=>void go('orders')} initialHorseId={params.get('horse')||undefined} initialDocumentId={params.get('document')||undefined} initialOrderId={params.get('order')!} onLeaveGuardChange={register} refreshNotifications={()=>{void refresh();void refreshNotices();}}/>}
 {view==='tracking'&&<TrackingWorkspace role="CUSTOMER" view="tracking" onNavigate={id=>void go(id)}/>}
 {view==='history'&&<Spin spinning={loading}><History orders={data.orders.filter(o => Number(o.paid) > 0 || isSettledOrder(o))} receipts={data.receipts || []} onOpen={id=>void go('orders',id)}/></Spin>}
 {view==='notifications'&&<NotificationsPanel notifications={notices} loading={false} error={noticeError} unreadOnly={unread} markingId={marking} onUnreadChange={setUnread} onRefresh={()=>void refreshNotices()} onMarkRead={id=>void markRead(id)} onOpen={notice=>{void go('orders',String(notice.order_id||notice.related_id),notice.horse_id?String(notice.horse_id):undefined,notice.document_id?String(notice.document_id):undefined);}}/>}
 {view==='account'&&<section className="customer-card customer-account"><span className="customer-avatar">{account.fullName.slice(0,1)}</span><h2>{account.fullName}</h2><dl>{[['Email',account.email],['Số điện thoại',account.phone],['Địa chỉ',account.address]].map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value||'Chưa cập nhật'}</dd></div>)}</dl></section>}
 </main></div></ConfigProvider>;
}

function History({orders,receipts,onOpen}:{orders:CustomerOrder[];receipts:CustomerReceipt[];onOpen:(id:string)=>void}){
  const [activeTab, setActiveTab] = useState<'receipts'|'orders'>('receipts');
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [page, setPage] = useState(1);
  const [year, setYear] = useState('');

  const filteredOrders = orders.filter(o => (!year || o.created_at?.slice(0,4) === year) && (!status || o.status === status) && `${o.order_code} ${o.origin_address||''} ${o.destination_address||''} ${o.horse_names||''}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));
  const filteredReceipts = receipts.filter(r => (!year || r.received_at?.slice(0,4) === year) && `${r.reference} ${r.order_code}`.toLocaleLowerCase().includes(search.toLocaleLowerCase()));

  const totalPaid = receipts.length > 0 
    ? receipts.reduce((sum, r) => sum + Number(r.amount), 0)
    : orders.reduce((sum, o) => sum + Number(o.paid), 0);

  function exportCsv(){
    const escape = (v: unknown) => {
      const s = String(v ?? '');
      return '"' + (/^[=+@\-]/.test(s) ? "'" + s : s).split('"').join('""') + '"';
    };
    if (activeTab === 'receipts') {
      const rows = [
        ['Mã giao dịch', 'Mã đơn hàng', 'Số tiền', 'Phương thức', 'Nguồn', 'Thời gian'],
        ...filteredReceipts.map(r => [
          r.reference,
          r.order_code,
          r.amount,
          paymentMethods[r.method] || r.method || 'Chuyển khoản QR',
          r.source === 'ONLINE_SIMULATION' ? 'Thanh toán trực tuyến (Mô phỏng)' : 'Quản lý thu tiền',
          new Date(r.received_at).toLocaleString('vi-VN')
        ])
      ];
      const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lich-su-thanh-toan.csv';
      a.click();
      URL.revokeObjectURL(url);
    } else {
      const rows = [
        ['Mã đơn', 'Ngày tạo', 'Điểm đi', 'Điểm đến', 'Báo giá', 'Đã thanh toán', 'Trạng thái'],
        ...filteredOrders.map(o => [o.order_code, date(o.created_at), o.origin_address, o.destination_address, o.quote_total, o.paid, statuses[o.status]])
      ];
      const url = URL.createObjectURL(new Blob(['\ufeff' + rows.map(r => r.map(escape).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = 'lich-su-don-hang.csv';
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <section className="customer-card">
      <div className="customer-heading">
        <div>
          <h2>Lịch sử giao dịch</h2>
          <p>Danh sách các giao dịch đặt cọc, thanh toán và các đơn hàng liên quan.</p>
        </div>
        <Button disabled={activeTab === 'receipts' ? !filteredReceipts.length : !filteredOrders.length} onClick={exportCsv}>
          Xuất danh sách ({activeTab === 'receipts' ? 'Giao dịch' : 'Đơn hàng'})
        </Button>
      </div>

      <div className="customer-stats history-stats">
        {[
          [money(totalPaid), 'Tổng đã thanh toán'],
          [receipts.length, 'Giao dịch thanh toán'],
          [orders.length, 'Đơn phát sinh GD'],
        ].map(([value, label]) => (
          <article key={String(label)}>
            <div>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          </article>
        ))}
      </div>

      <Tabs
        activeKey={activeTab}
        onChange={k => { setActiveTab(k as any); setPage(1); }}
        items={[
          { key: 'receipts', label: `Các lần giao dịch thanh toán (${receipts.length})` },
          { key: 'orders', label: `Đơn hàng đã thanh toán / đặt cọc (${orders.length})` },
        ]}
      />

      {activeTab === 'receipts' ? (
        <>
          <div className="customer-filters">
            <label>
              Tìm kiếm
              <Input
                value={search}
                placeholder="Mã giao dịch, mã đơn…"
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </label>
            <label>
              Thời gian
              <Select
                value={year}
                options={[
                  { value: '', label: 'Tất cả thời gian' },
                  ...Array.from(new Set(receipts.map(r => r.received_at?.slice(0, 4)).filter(Boolean)))
                    .sort()
                    .reverse()
                    .map(y => ({ value: y, label: 'Năm ' + y })),
                ]}
                onChange={v => { setYear(v); setPage(1); }}
              />
            </label>
          </div>

          <div className="customer-table">
            <table style={{ width: '100%' }}>
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Mã GD</th>
                  <th style={{ width: '14%', whiteSpace: 'nowrap' }}>Mã đơn</th>
                  <th style={{ width: '14%', whiteSpace: 'nowrap' }}>Số tiền</th>
                  <th style={{ width: '14%', whiteSpace: 'nowrap' }}>Phương thức</th>
                  <th style={{ width: '14%', whiteSpace: 'nowrap' }}>Nguồn</th>
                  <th style={{ width: '16%', whiteSpace: 'nowrap' }}>Thời gian</th>
                  <th style={{ width: '10%', whiteSpace: 'nowrap' }}>Trạng thái</th>
                </tr>
              </thead>
              <tbody>
                {filteredReceipts.slice((page - 1) * 10, page * 10).map(r => (
                  <tr key={r.id}>
                    <td>
                      <strong style={{ color: '#0c3e47', fontFamily: 'monospace', fontSize: 12, wordBreak: 'break-all' }}>
                        {r.reference}
                      </strong>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button onClick={() => onOpen(String(r.order_id))}>
                        {r.order_code}
                      </button>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <b style={{ color: '#059669', fontSize: 14, whiteSpace: 'nowrap' }}>
                        {money(r.amount)}
                      </b>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Tag color="cyan" style={{ margin: 0 }}>
                        {paymentMethods[r.method] || r.method || 'Chuyển khoản QR'}
                      </Tag>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Tag color={r.source === 'ONLINE_SIMULATION' ? 'blue' : 'orange'} style={{ margin: 0 }}>
                        {r.source === 'ONLINE_SIMULATION' ? 'Thanh toán mô phỏng' : 'Quản lý thu'}
                      </Tag>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{new Date(r.received_at).toLocaleString('vi-VN')}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Tag color="success" className="customer-payment-success" style={{ margin: 0 }}>Thành công</Tag>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredReceipts.length && <Empty description="Chưa có giao dịch thanh toán nào" />}
          <Pagination
            current={page}
            pageSize={10}
            total={filteredReceipts.length}
            showSizeChanger={false}
            onChange={setPage}
          />
        </>
      ) : (
        <>
          <div className="customer-filters">
            <label>
              Tìm kiếm
              <Input
                value={search}
                placeholder="Mã đơn, tuyến vận chuyển…"
                onChange={e => { setSearch(e.target.value); setPage(1); }}
              />
            </label>
            <label>
              Trạng thái
              <Select
                value={status}
                options={[
                  { value: '', label: 'Tất cả' },
                  ...Object.entries(statuses).map(([value, label]) => ({ value, label })),
                ]}
                onChange={v => { setStatus(v); setPage(1); }}
              />
            </label>
            <label>
              Thời gian
              <Select
                value={year}
                options={[
                  { value: '', label: 'Tất cả thời gian' },
                  ...Array.from(new Set(orders.map(o => o.created_at?.slice(0, 4)).filter(Boolean)))
                    .sort()
                    .reverse()
                    .map(y => ({ value: y, label: 'Năm ' + y })),
                ]}
                onChange={v => { setYear(v); setPage(1); }}
              />
            </label>
          </div>

          <div className="customer-table">
            <table>
              <thead>
                <tr>
                  {['Mã đơn', 'Ngày tạo', 'Tuyến · ngựa', 'Báo giá', 'Thanh toán', 'Trạng thái'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredOrders.slice((page - 1) * 10, page * 10).map(o => (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <button onClick={() => onOpen(o.id)}>{o.order_code}</button>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{date(o.created_at)}</td>
                    <td>
                      {o.origin_address || o.origin_country || 'Chưa chọn'} → {o.destination_address || o.destination_country || 'Chưa chọn'}
                      <small>{o.horse_names || `${o.horse_count || 0} ngựa`}</small>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>{o.quote_total === null ? 'Chưa báo giá' : money(o.quote_total)}</td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <b style={{ whiteSpace: 'nowrap' }}>{money(o.paid)}</b>
                      <small style={{ whiteSpace: 'nowrap' }}>
                        {Number(o.paid) <= 0
                          ? 'Chưa thanh toán'
                          : o.quote_total !== null && Number(o.paid) >= Number(o.quote_total)
                          ? 'Đã thanh toán đủ'
                          : 'Đã đặt cọc / một phần'}
                      </small>
                    </td>
                    <td style={{ whiteSpace: 'nowrap' }}>
                      <Status value={o.status} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!filteredOrders.length && <Empty description="Không có đơn hàng phù hợp" />}
          <Pagination
            current={page}
            pageSize={10}
            total={filteredOrders.length}
            showSizeChanger={false}
            onChange={setPage}
          />
        </>
      )}
    </section>
  );
}
