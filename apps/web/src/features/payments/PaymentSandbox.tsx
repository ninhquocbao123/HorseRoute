import {useEffect,useState} from 'react';
import {useNavigate,useSearchParams} from 'react-router-dom';
import {Alert,Button,QRCode,Result,Spin} from 'antd';
import {BankOutlined,CreditCardOutlined,WalletOutlined,ArrowLeftOutlined,SafetyCertificateOutlined} from '@ant-design/icons';
import {api} from '../../lib/axios';
import {useOrderSocket} from '../../lib/socket';
import './payment-sandbox.css';

type Method='BANK_TRANSFER'|'E_WALLET'|'CARD';
type Session={sessionCode:string;orderId:string;orderCode:string;amount:number;paymentMethod:Method;status:string;expiresAt:string};
const money=(n:number)=>Number(n||0).toLocaleString('vi-VN')+' đ';
const methods:{id:Method;title:string;note:string;icon:React.ReactNode}[]=[
 {id:'BANK_TRANSFER',title:'Ứng dụng ngân hàng · QR',note:'Mã QR thử nghiệm, không chuyển tiền thật',icon:<BankOutlined/>},
 {id:'E_WALLET',title:'Ví điện tử',note:'Xác nhận trên màn hình ví giả lập',icon:<WalletOutlined/>},
 {id:'CARD',title:'Thẻ thanh toán quốc tế',note:'Sử dụng thẻ mẫu, không nhập thông tin thẻ thật',icon:<CreditCardOutlined/>},
];
export default function PaymentSandbox(){
 const [params,setParams]=useSearchParams(),navigate=useNavigate();
 const orderId=params.get('order')||'',type=params.get('type')==='BALANCE'?'BALANCE':'DEPOSIT',code=params.get('session');
 const [session,setSession]=useState<Session|null>(null),[summary,setSummary]=useState<{orderCode:string;deposit:number;paid:number;balance:number}|null>(null),[busy,setBusy]=useState(false),[loading,setLoading]=useState(true),[error,setError]=useState(''),[now,setNow]=useState(Date.now()),[wallet,setWallet]=useState(false);
 const back=()=>navigate('/dashboard?view=orders&order='+encodeURIComponent(orderId));
 useEffect(()=>{let active=true;setLoading(true);setError('');setSession(null);setWallet(false);
 const request=code?api.get<Session>('/payments/sessions/'+encodeURIComponent(code)):api.get('/payments/orders/'+encodeURIComponent(orderId));
 request.then(r=>{if(!active)return;if(code){if(String(r.data.orderId)!==orderId)throw Error('Phiên không thuộc đơn này.');setSession(r.data);}else setSummary(r.data);}).catch(e=>{if(active)setError(e.response?.data?.message||'Không tải được thông tin thanh toán.');}).finally(()=>{if(active)setLoading(false);});return()=>{active=false;};},[code,orderId]);
 useEffect(()=>{const id=window.setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(id);},[]);
 useOrderSocket(orderId,{onPaymentUpdate:()=>{if(code)void api.get<Session>('/payments/sessions/'+encodeURIComponent(code)).then(r=>setSession(r.data)).catch(()=>{});},onReconnect:()=>{if(code)void api.get<Session>('/payments/sessions/'+encodeURIComponent(code)).then(r=>setSession(r.data)).catch(()=>{});}});
 const seconds=session?Math.min(900,Math.max(0,Math.ceil((new Date(session.expiresAt).getTime()-now)/1000))):0;
 async function choose(method:Method){if(busy)return;setBusy(true);setError('');try{const r=await api.post('/payments/sessions',{orderId,paymentType:type,paymentMethod:method});setParams({order:orderId,type,session:r.data.sessionCode});}catch(e:any){setError(e.response?.data?.message||'Không tạo được phiên thanh toán.');}finally{setBusy(false);}}
 async function finish(result:'SUCCESS'|'FAILED'|'CANCELLED'){if(!session||busy)return;setBusy(true);setError('');try{await api.post('/payments/sessions/'+encodeURIComponent(session.sessionCode)+'/complete',{result});setSession({...session,status:result});setWallet(false);}catch(e:any){setError(e.response?.data?.message||'Chưa xác nhận được kết quả. Vui lòng tải lại trang để kiểm tra trước khi thử lại.');}finally{setBusy(false);}}
 const retry=()=>setParams({order:orderId,type});
 return <main className="sandbox-page"><nav><button onClick={back} disabled={busy}><ArrowLeftOutlined/> Quay lại đơn hàng</button><span>Tiếng Việt · VN</span></nav><section className={'sandbox-sheet '+(!session?'sandbox-choose':'')}>
 <header><div className="sandbox-brand"><span>VCN</span> PAY <small>SANDBOX</small></div>{session?.status==='PENDING'&&<div className="sandbox-timer">Phiên hết hạn sau <b>{String(Math.floor(seconds/60)).padStart(2,'0')} : {String(seconds%60).padStart(2,'0')}</b></div>}</header>
 <Alert type="warning" showIcon title="Môi trường giả lập — không thu tiền thật" description="Đây là trang thử nghiệm của Vận chuyển ngựa, không phải cổng VNPAY. Không quét bằng ứng dụng thanh toán thật."/>
 {error&&<Alert type="error" showIcon title={error}/>}<Spin spinning={loading||busy}><div className="sandbox-content">
 {!loading&&!error&&!session&&<><h1>Chọn phương thức thanh toán <small>(Test)</small></h1><p className="sandbox-summary">{summary?.orderCode} · {type==='DEPOSIT'?'Đặt cọc':'Thanh toán còn lại'} <strong>{money(type==='DEPOSIT'?Math.max(0,(summary?.deposit||0)-(summary?.paid||0)):summary?.balance||0)}</strong></p><div className="sandbox-methods">{methods.map(m=><button key={m.id} disabled={busy} onClick={()=>void choose(m.id)}><span><strong>{m.title}</strong><small>{m.note}</small></span>{m.icon}</button>)}</div></>}
 {session&&session.status!=='PENDING'&&<Result status={session.status==='SUCCESS'?'success':session.status==='FAILED'?'error':'warning'} title={session.status==='SUCCESS'?'Thanh toán giả lập thành công':session.status==='FAILED'?'Thanh toán không thành công':'Giao dịch đã hủy'} subTitle={session.orderCode+' · '+money(session.amount)} extra={<><Button type="primary" onClick={back}>Về đơn hàng</Button>{session.status!=='SUCCESS'&&<Button onClick={retry}>Thử lại với phiên mới</Button>}</>}/>}
 {session?.status==='PENDING'&&<><div className="sandbox-columns"><aside><h2>Thông tin đơn hàng (Test)</h2><dl><dt>Số tiền thanh toán</dt><dd className="sandbox-amount">{money(session.amount)}</dd><dt>Phí giao dịch</dt><dd>0 đ</dd><dt>Mã đơn hàng</dt><dd>{session.orderCode}</dd><dt>Mã giao dịch</dt><dd>{session.sessionCode}</dd><dt>Nhà cung cấp</dt><dd>Vận chuyển ngựa</dd></dl></aside><article>
 <h2>{session.paymentMethod==='CARD'?'Thẻ thanh toán thử nghiệm':wallet?'Xác nhận trên ví giả lập':'Mã QR thanh toán thử nghiệm'}</h2>
 {seconds===0?<Alert type="warning" title="Phiên đã hết hạn" action={<Button onClick={retry}>Tạo phiên mới</Button>}/>:<>
 {session.paymentMethod==='CARD'?<div className="sandbox-card"><span>TEST CARD · VISA</span><strong>4532 •••• •••• 8899</strong><span>NGUYEN VAN A <em>12/28</em></span><small>Thẻ mẫu · Không cần nhập thông tin</small></div>:wallet?<div className="sandbox-wallet"><WalletOutlined/><strong>{money(session.amount)}</strong><p>Xác nhận thanh toán cho đơn {session.orderCode}</p><Button type="primary" disabled={busy} onClick={()=>void finish('SUCCESS')}>Xác nhận thanh toán giả lập</Button></div>:<div className="sandbox-qr"><QRCode size={210} value={'VCN_SANDBOX_ONLY:'+session.sessionCode} bordered={false}/><span>QR dành riêng cho phiên thử nghiệm</span></div>}
 {session.paymentMethod==='E_WALLET'&&!wallet&&<Button type="primary" onClick={()=>setWallet(true)}>Mở ví giả lập</Button>}
 {wallet&&<Button onClick={()=>setWallet(false)}>Quay lại mã QR</Button>}
 </>}
 <Button type="text" disabled={busy} onClick={()=>void finish('CANCELLED')}>Hủy thanh toán</Button></article></div>
 {seconds>0&&<section className="sandbox-simulate"><div><strong>Điều khiển mô phỏng</strong><small>Chọn kết quả để kiểm tra cập nhật đơn hàng.</small></div><Button type="primary" disabled={busy} onClick={()=>void finish('SUCCESS')}>Giả lập thành công</Button><Button danger disabled={busy} onClick={()=>void finish('FAILED')}>Giả lập thất bại</Button></section>}
 </>}
 </div></Spin><footer><SafetyCertificateOutlined/> Dữ liệu thử nghiệm · Không kết nối ngân hàng hoặc ví thật</footer></section><p className="sandbox-copyright">Vận chuyển ngựa · Cổng thanh toán thử nghiệm</p></main>;
}
