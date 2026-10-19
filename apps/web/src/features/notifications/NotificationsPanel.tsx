import { BellOutlined, CheckOutlined, ReloadOutlined } from '@ant-design/icons';
import { Alert, Badge, Button, Card, Empty, List, Segmented, Tag } from 'antd';
import './notifications.css';

export type Notice = { id: string; content: string; is_read: number };

type Props = {
  notifications: Notice[];
  loading: boolean;
  error: string;
  unreadOnly: boolean;
  markingId: string | null;
  onUnreadChange: (unread: boolean) => void;
  onRefresh: () => void;
  onMarkRead: (id: string) => void;
};

export default function NotificationsPanel({notifications,loading,error,unreadOnly,markingId,onUnreadChange,onRefresh,onMarkRead}:Props) {
  const unreadCount=notifications.filter(notification=>!notification.is_read).length;
  const filtered=notifications.filter(notification=>!unreadOnly||!notification.is_read);
  return <Card className="notification-center" bordered={false}>
    <div className="notification-center__header"><div><span className="notification-center__eyebrow">TRUNG TÂM THÔNG BÁO</span><h2>Hộp thông báo</h2><p>Theo dõi các yêu cầu và cập nhật nghiệp vụ cần bạn chú ý.</p></div><Button icon={<ReloadOutlined/>} loading={loading} onClick={onRefresh}>Làm mới</Button></div>
    <div className="notification-center__summary" aria-label="Tổng quan thông báo"><div><span>Tổng thông báo</span><strong>{notifications.length}</strong></div><div><span>Chưa đọc</span><strong>{unreadCount}</strong></div><div><span>Đã đọc</span><strong>{notifications.length-unreadCount}</strong></div></div>
    <div className="notification-center__toolbar"><Segmented value={unreadOnly?'unread':'all'} options={[{label:`Tất cả (${notifications.length})`,value:'all'},{label:`Chưa đọc (${unreadCount})`,value:'unread'}]} onChange={value=>onUnreadChange(value==='unread')}/></div>
    {error&&<Alert type="error" showIcon message="Không thể tải thông báo" description={error} action={<Button size="small" danger onClick={onRefresh}>Thử lại</Button>}/>}
    <List className="notification-center__list" loading={loading} dataSource={error?[]:filtered} locale={{emptyText:!loading&&!error?<Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={unreadOnly?'Bạn đã đọc tất cả thông báo':'Chưa có thông báo'}/>:null}} renderItem={notification=>{const unread=!notification.is_read;return <List.Item className={unread?'notification-center__item is-unread':'notification-center__item'} actions={unread?[<Button key="read" type="primary" ghost icon={<CheckOutlined/>} loading={markingId===notification.id} disabled={markingId!==null&&markingId!==notification.id} onClick={()=>onMarkRead(notification.id)}>Đánh dấu đã đọc</Button>]:[<Tag key="read" className="notification-center__read-tag" icon={<CheckOutlined/>}>Đã đọc</Tag>]}><List.Item.Meta avatar={<Badge dot={unread} color="#b09050"><span className="notification-center__icon"><BellOutlined/></span></Badge>} title={<span>{unread?'Thông báo mới':'Thông báo'}</span>} description={notification.content}/></List.Item>;}}/>
  </Card>;
}
