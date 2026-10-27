import { CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Button, Card, Empty, List, Segmented, Tooltip } from 'antd';
import { timeAgo } from './time-ago';
import './notifications.css';

export type Notice = { id: string; content: string; is_read: number; created_at?: string; event_type?:string; related_type?:string; related_id?:string; order_id?:string; horse_id?:string; document_id?:string };

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
  /** Có thì hiện "Đánh dấu tất cả đã đọc" ở đầu danh sách. */
  onMarkAllRead?: () => void;
  /** Khung tài xế: ẩn đầu trang, mô tả và 3 ô thống kê (mặc định giữ nguyên cho các vai trò khác). */
  compact?: boolean;
  /** Màu viền trái / chấm của thông báo chưa đọc theo loại. */
  accentOf?: (notice: Notice) => string;
};

export default function NotificationsPanel({notifications,loading,error,unreadOnly,markingId,onUnreadChange,onRefresh,onMarkRead,onOpen,onMarkAllRead,compact,accentOf}:Props) {
  const unreadCount=notifications.filter(notification=>!notification.is_read).length;
  const filtered=notifications.filter(notification=>!unreadOnly||!notification.is_read);
  return <Card className={compact?"notification-center is-compact":"notification-center"} bordered={false}>
    {!compact&&<>
    <div className="notification-center__header"><div><span className="notification-center__eyebrow">TRUNG TÂM THÔNG BÁO</span><h2>Hộp thông báo</h2><p>Theo dõi các yêu cầu và cập nhật nghiệp vụ cần bạn chú ý.</p></div><Button icon={<ReloadOutlined/>} loading={loading} onClick={onRefresh}>Làm mới</Button></div>
    <div className="notification-center__summary" aria-label="Tổng quan thông báo"><div><span>Tổng thông báo</span><strong>{notifications.length}</strong></div><div><span>Chưa đọc</span><strong>{unreadCount}</strong></div><div><span>Đã đọc</span><strong>{notifications.length-unreadCount}</strong></div></div>
    </>}
    <div className="notification-center__toolbar"><Segmented value={unreadOnly?'unread':'all'} options={[{label:`Tất cả (${notifications.length})`,value:'all'},{label:`Chưa đọc (${unreadCount})`,value:'unread'}]} onChange={value=>onUnreadChange(value==='unread')}/>{onMarkAllRead&&unreadCount>0&&<Button type="link" size="small" className="notification-center__mark-all" onClick={onMarkAllRead}>Đánh dấu tất cả đã đọc</Button>}</div>
    {error&&<Alert type="error" showIcon title="Không thể tải thông báo" description={error} action={<Button size="small" danger onClick={onRefresh}>Thử lại</Button>}/>}
    <List className="notification-center__list" loading={loading} dataSource={error?[]:filtered} locale={{emptyText:!loading&&!error?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={unreadOnly?'Bạn đã đọc tất cả thông báo':'Chưa có thông báo'}/>:null}} renderItem={notification=>{const unread=!notification.is_read;const openable=onOpen&&(notification.order_id||(notification.related_type==='ORDER'&&notification.related_id));return <List.Item className={unread?'notification-center__item is-unread':'notification-center__item'} style={unread&&accentOf?({'--nc-accent':accentOf(notification)} as React.CSSProperties):undefined}>
      <div className="notification-center__row" role={unread?'button':undefined} tabIndex={unread?0:undefined} aria-label={unread?'Đánh dấu đã đọc: '+notification.content:undefined} onClick={()=>{if(unread&&markingId===null)onMarkRead(notification.id);}} onKeyDown={event=>{if(unread&&markingId===null&&(event.key==='Enter'||event.key===' ')){event.preventDefault();onMarkRead(notification.id);}}}>
        <span className="notification-center__dot" aria-label={unread?'Chưa đọc':undefined}/>
        <div className="notification-center__body">
          <p className="notification-center__text" title={notification.content}>{notification.content}</p>
          <div className="notification-center__meta">{notification.created_at&&<time dateTime={notification.created_at}>{timeAgo(notification.created_at)}</time>}{openable&&<Button size="small" onClick={event=>{event.stopPropagation();onOpen(notification);}}>{notification.event_type==='DOCUMENT_SUPPLEMENT'||notification.event_type==='DOCUMENT_UPDATE'?'Bổ sung giấy tờ':'Xem đơn hàng'}</Button>}</div>
        </div>
        {unread&&<Tooltip title="Đánh dấu đã đọc"><Button type="text" shape="circle" size="small" className="notification-center__check" aria-label="Đánh dấu đã đọc" icon={<CheckOutlined/>} loading={markingId===notification.id} disabled={markingId!==null&&markingId!==notification.id} onClick={event=>{event.stopPropagation();onMarkRead(notification.id);}}/></Tooltip>}
      </div>
    </List.Item>;}}/>
  </Card>;
}
