import { calculateEstimate, type PricingConfig } from '@my-project/shared';
import { Alert, Button } from 'antd';
import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api } from '../../lib/axios';
import { useAuth } from '../auth/hooks/useAuth';
import PublicSymbols from './PublicSymbols';
import LandingMarkup from './LandingMarkup';
import { initializeLanding } from './landing-v7.behavior';
import { onPricingPublished } from '../pricing/pricing-sync';
import './landing-page.css';

export default function LandingPage() {
  const root = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const { account } = useAuth();
  const [priceBook,setPriceBook]=useState<{id:string;title:string;config:PricingConfig}|null>(null);
  const [pricingError,setPricingError]=useState('');
  const [reload,setReload]=useState(0);
  useEffect(()=>{
    let active=true,request=0;const controller=new AbortController();
    async function load(){const current=++request;try{const {data}=await api.get('/pricing/current',{signal:controller.signal});if(active&&current===request){setPriceBook(previous=>previous?.id===data.id?previous:data);setPricingError('');}}catch{if(active&&current===request)setPricingError('Chưa tải được bảng giá từ máy chủ. Vui lòng thử lại.');}}
    void load();const timer=window.setInterval(()=>void load(),60000);window.addEventListener('focus',load);
    const unsubscribe=onPricingPublished(()=>void load());
    return()=>{active=false;controller.abort();clearInterval(timer);window.removeEventListener('focus',load);unsubscribe();};
  },[reload]);
  useEffect(() => {
    if (!root.current) return;
    return initializeLanding(root.current, path => navigate(account && path === '/login' ? '/dashboard' : path), async (code, phone) => {
      if (!account) { navigate(`/login?order=${encodeURIComponent(code)}`); return { message: 'Đăng nhập để xem đơn hàng của bạn.', step: 0 }; }
      if (account.role !== 'CUSTOMER' || !account.phone?.replace(/\D/g, '').endsWith(phone)) return { message: 'Không tìm thấy đơn phù hợp với thông tin đã nhập.', step: 0 };
      const { data } = await api.get<{ items: { id: string; order_code: string; status: string }[] }>('/orders', { params: { search: code, limit: 10, page: 1 } });
      const order = data.items.find(item => item.order_code.toLowerCase() === code.toLowerCase());
      if (!order) return { message: 'Không tìm thấy đơn phù hợp với thông tin đã nhập.', step: 0 };
      const steps: Record<string, number> = { DRAFT: 0, PENDING: 1, NEED_INFO: 2, APPROVED: 2, PREPARING: 3, READY: 3, IN_TRANSIT: 4, DELIVERED: 5 };
      const labels: Record<string, string> = { DRAFT: 'Bản nháp', PENDING: 'Đã nhận đơn', NEED_INFO: 'Cần bổ sung thông tin', REJECTED: 'Đã từ chối', APPROVED: 'Đã duyệt', PREPARING: 'Đang chuẩn bị', READY: 'Sẵn sàng vận chuyển', IN_TRANSIT: 'Đang vận chuyển', DELIVERED: 'Đã bàn giao', CANCELLED: 'Đã hủy' };
      return { message: `${order.order_code}: ${labels[order.status] || order.status}`, step: steps[order.status] || 0 };
    },priceBook,input=>calculateEstimate(priceBook!.config,input,priceBook!.id));
  }, [account, navigate,priceBook]);
  return <div ref={root} className="v7-public"><PublicSymbols />{pricingError&&<Alert type="warning" message={pricingError} action={<Button onClick={()=>setReload(n=>n+1)}>Thử lại</Button>}/>}<LandingMarkup /><button type="button" className="totop on" aria-label="Lên đầu trang" onClick={() => window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion:reduce)').matches ? 'instant' : 'smooth' })}><svg viewBox="0 0 24 24"><path d="M6 15l6-6 6 6"/></svg></button></div>;
}
