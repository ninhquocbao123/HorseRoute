import { BellOutlined, CheckOutlined, ReloadOutlined, CheckCircleOutlined, ExclamationCircleOutlined, CloseCircleOutlined, InfoCircleOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Empty, List, Segmented, Tag } from 'antd';
import './notifications.css';

export type Notice = { id: string; content: string; is_read: number; created_at?:string; event_type?:string; related_type?:string; related_id?:string; order_id?:string; horse_id?:string; document_id?:string };

export function noticePresentation(event='') {
 if(/REJECT|FAILED|CANCEL/.test(event))return {title:/CANCEL/.test(event)?'Giao dịch đã hủy':'Yêu cầu chưa được chấp nhận',tone:'error',icon:<CloseCircleOutlined/>};
 if(/SUPPLEMENT|NEED_INFO|EXPIRED|DOCUMENT_UPDATE/.test(event))return {title:'Cần bổ sung giấy tờ',tone:'warning',icon:<ExclamationCircleOutlined/>};
 if(/PAYMENT_RECEIVED|PAYMENT_SUCCESS/.test(event))return {title:'Đã ghi nhận thanh toán',tone:'success',icon:<CheckCircleOutlined/>};
 if(/QUOTE_APPROVED/.test(event))return {title:'Báo giá đã được duyệt',tone:'success',icon:<CheckCircleOutlined/>};
 if(/APPROVED|SUCCESS/.test(event))return {title:'Yêu cầu đã được duyệt',tone:'success',icon:<CheckCircleOutlined/>};
 return {title:'Cập nhật đơn hàng',tone:'info',icon:<InfoCircleOutlined/>};
}

type Props = {
  notifications: Notice[];
  loading: boolean;
  error: string;
  unreadOnly: boolean;
  markingId: string | null;
  onUnreadChange: (unread: boolean) => void;
  onRefresh: () => void;
  onMarkRead: (id: string) => void;
  onOpen?: (notice: Notice) => void;
};

export default function NotificationsPanel({notifications,loading,error,unreadOnly,markingId,onUnreadChange,onRefresh,onMarkRead,onOpen}:Props) {
  const unreadCount=notifications.filter(notification=>!notification.is_read).length;
  const filtered=notifications.filter(notification=>!unreadOnly||!notification.is_read);
  return <Card className="notification-center" bordered={false}>
    <div className="notification-center__header"><div><span className="notification-center__eyebrow">TRUNG TÂM THÔNG BÁO</span><h2>Hộp thông báo</h2><p>Theo dõi các yêu cầu và cập nhật nghiệp vụ cần bạn chú ý.</p></div><Button icon={<ReloadOutlined/>} loading={loading} onClick={onRefresh}>Làm mới</Button></div>
    <div className="notification-center__summary" aria-label="Tổng quan thông báo"><div><span>Tổng thông báo</span><strong>{notifications.length}</strong></div><div><span>Chưa đọc</span><strong>{unreadCount}</strong></div><div><span>Đã đọc</span><strong>{notifications.length-unreadCount}</strong></div></div>
    <div className="notification-center__toolbar"><Segmented value={unreadOnly?'unread':'all'} options={[{label:`Tất cả (${notifications.length})`,value:'all'},{label:`Chưa đọc (${unreadCount})`,value:'unread'}]} onChange={value=>onUnreadChange(value==='unread')}/></div>
    {error&&<Alert type="error" showIcon message="Không thể tải thông báo" description={error} action={<Button size="small" danger onClick={onRefresh}>Thử lại</Button>}/>}
    <List className="notification-center__list" loading={loading} dataSource={error?[]:filtered} locale={{emptyText:!loading&&!error?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={unreadOnly?'Bạn đã đọc tất cả thông báo':'Chưa có thông báo'}/>:null}} renderItem={notification=>{const unread=!notification.is_read,presentation=noticePresentation(notification.event_type);return <List.Item className={unread?'notification-center__item is-unread':'notification-center__item'} actions={unread?[<Button key="read" className="notification-mark-read" icon={<CheckOutlined/>} loading={markingId===notification.id} disabled={markingId!==null&&markingId!==notification.id} onClick={()=>onMarkRead(notification.id)}>Đánh dấu đã đọc</Button>]:[<Tag key="read" className="notification-center__read-tag" icon={<CheckOutlined/>}>Đã đọc</Tag>]}><List.Item.Meta avatar={<Badge dot={unread} color="#387ba8"><span className={"notification-center__icon tone-"+presentation.tone}>{presentation.icon}</span></Badge>} title={<span>{presentation.title}{notification.created_at&&<time className="notification-center__time" dateTime={notification.created_at}>{new Date(notification.created_at).toLocaleString('vi-VN',{timeZone:'Asia/Ho_Chi_Minh',hour:'2-digit',minute:'2-digit',day:'2-digit',month:'2-digit'})}</time>}</span>} description={<>{notification.content}{onOpen&&(notification.order_id||(notification.related_type==='ORDER'&&notification.related_id))&&<div><Button onClick={()=>onOpen(notification)}>{notification.event_type==='DOCUMENT_SUPPLEMENT'||notification.event_type==='DOCUMENT_UPDATE'?'Bổ sung giấy tờ':'Xem đơn hàng'}</Button></div>}</>}/></List.Item>;}}/>
  </Card>;
}
