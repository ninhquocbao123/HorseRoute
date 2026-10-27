import {useCallback,useEffect,useState} from 'react';
import {useLocation,useNavigate,useSearchParams} from 'react-router-dom';
import {Alert,Button,Result,Spin} from 'antd';
import {api} from '../../lib/axios';
import {useOrderSocket} from '../../lib/socket';
import './payment-sandbox.css';
export default function VnpayCheckout(){
 const [params]=useSearchParams(),location=useLocation(),navigate=useNavigate();
 const returning=location.pathname.endsWith('/return'),ref=params.get('vnp_TxnRef')||'',order=params.get('order')||'',paymentType=params.get('type')==='BALANCE'?'BALANCE':'DEPOSIT';
 const [data,setData]=useState<any>(null),[error,setError]=useState(''),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false);
 const load=useCallback(async()=>{try{const r=await api.get(returning?'/payments/sessions/'+encodeURIComponent(ref):'/payments/orders/'+encodeURIComponent(order));setData(r.data);setError('');}catch(e:any){setError(e.response?.data?.message||'Không tải được thông tin thanh toán.');}finally{setLoading(false);}},[returning,ref,order]);
 useEffect(()=>{setData(null);setLoading(true);void load();},[load]);
 useEffect(()=>{if(!returning||data?.status!=='PENDING')return;const id=window.setInterval(()=>void load(),5000);return()=>clearInterval(id);},[returning,data?.status,load]);
 useOrderSocket(data?.orderId||order,{onPaymentUpdate:()=>void load(),onReconnect:()=>void load()});
 async function pay(){if(busy)return;setBusy(true);setError('');try{const r=await api.post('/payments/vnpay',{orderId:order,paymentType,paymentMethod:'BANK_TRANSFER'});const url=new URL(r.data.paymentUrl);if(url.origin!=='https://sandbox.vnpayment.vn')throw Error('Invalid payment URL');window.location.assign(url.href);}catch(e:any){setError(e.response?.data?.message||'Không mở được cổng VNPAY Sandbox.');setBusy(false);}}
 const back=()=>navigate('/dashboard?view=orders&order='+encodeURIComponent(data?.orderId||order));
 const amount=paymentType==='DEPOSIT'?Math.max(0,Number(data?.deposit||0)-Number(data?.paid||0)):Number(data?.balance||0);
 return <main className="sandbox-page"><section className="sandbox-sheet sandbox-choose"><header><h1 style={{fontSize:22,margin:0}}>Thanh toán qua VNPAY</h1><span>Sandbox · Thử nghiệm</span></header><div className="sandbox-content"><Alert type="info" showIcon title="Môi trường thử nghiệm, không thu tiền thật" description="Bạn sẽ chọn phương thức và thực hiện thanh toán trên cổng VNPAY Sandbox."/>{error&&<Alert style={{marginTop:16}} type="error" showIcon title={error}/>}<Spin spinning={loading}>
 {returning?<Result status={data?.status==='SUCCESS'?'success':['FAILED','CANCELLED'].includes(data?.status)?'warning':'info'} title={data?.status==='SUCCESS'?'Thanh toán thành công':data?.status==='FAILED'?'Thanh toán không thành công':data?.status==='CANCELLED'?'Giao dịch đã hủy':'Đang chờ VNPAY xác nhận'} subTitle={data?.status==='PENDING'?'Hệ thống đang chờ thông báo từ VNPAY. Tiền chỉ được ghi nhận sau khi xác minh kết quả.':data?.orderCode} extra={<><Button type="primary" onClick={back}>Về đơn hàng</Button><Button onClick={()=>void load()}>Kiểm tra lại</Button></>}/>:<><p className="sandbox-summary">{data?.orderCode}<strong>{amount.toLocaleString('vi-VN')} đ</strong>{paymentType==='DEPOSIT'?'Tiền đặt cọc':'Số tiền còn lại'}</p><Button block type="primary" size="large" loading={busy} disabled={loading||!data||amount<=0} onClick={()=>void pay()}>Tiếp tục đến VNPAY Sandbox</Button><Button block type="text" disabled={busy} onClick={back}>Quay lại đơn hàng</Button></>}
 </Spin></div></section></main>;
}
