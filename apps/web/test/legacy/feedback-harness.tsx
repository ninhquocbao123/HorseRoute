import React from 'react';
import {createRoot} from 'react-dom/client';
import {Button,Alert} from 'antd';
import AntDesignProvider from '../src/app/providers/AntDesignProvider';
import {useFeedback} from '../src/components/useFeedback';
import NotificationsPanel from '../src/features/notifications/NotificationsPanel';
function Demo(){const {message,modal}=useFeedback();return <main style={{padding:24,maxWidth:900,margin:'auto'}}><Button onClick={()=>{message.success('Đơn VCN-20261025-0002 đã được duyệt.');message.success('Đơn VCN-20261025-0002 đã được duyệt.');}}>Thành công hai lần</Button><Button onClick={()=>message.error('Không gửi được giấy tờ. Vui lòng thử lại.')}>Lỗi</Button><Button onClick={()=>modal.confirm({title:'Duyệt hồ sơ?',content:'Kết quả sẽ được gửi cho khách.',okText:'Duyệt hồ sơ'})}>Xác nhận</Button><Alert showIcon type="warning" title="Cần bổ sung giấy tờ" description="Velvet Thunder thiếu kết quả EIA hợp lệ."/><NotificationsPanel notifications={[{id:'1',content:'Đơn VCN-20261025-0002 đã nhận 11.886.495 đ.',event_type:'PAYMENT_SUCCESS',created_at:'2026-10-26T03:00:00Z',is_read:0,order_id:'1'},{id:'2',content:'Velvet Thunder thiếu kết quả EIA hợp lệ.',event_type:'DOCUMENT_SUPPLEMENT',is_read:0,order_id:'1'}]} loading={false} error="" unreadOnly={false} markingId={null} onUnreadChange={()=>{}} onRefresh={()=>{}} onMarkRead={()=>{}} onOpen={()=>{}}/></main>}
createRoot(document.getElementById('root')!).render(<AntDesignProvider><Demo/></AntDesignProvider>);
