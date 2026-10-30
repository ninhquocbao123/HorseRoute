import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge, Button, Empty, Popover, Segmented, Spin, Tooltip } from 'antd';
import { BellOutlined, ExclamationCircleFilled, NotificationOutlined } from '@ant-design/icons';
import type { Notice } from '../../../features/notifications/NotificationsPanel';
import { timeAgo } from '../../../features/notifications/time-ago';
import { coordinatorPaths } from '../routes/coordinator.paths';
import { useIncidentCenter } from './IncidentCenter';

const isIncident = (notice: Notice) => notice.related_type === 'INCIDENT' || notice.event_type === 'INCIDENT_REPORTED';

/**
 * Chuông trên header: chấm đỏ + số chưa đọc. Mở ra là khung cố định (cuộn bên trong); bấm một thông báo thì MỞ RỘNG ngay trong khung
 * để đọc toàn văn (và đánh dấu đã đọc). Thông báo sự cố chỉ hiện nút "Xử lý sự cố" sau khi đã mở ra đọc.
 */
export default function CoordinatorBell() {
  const navigate = useNavigate();
  const { notifications, goHandle } = useIncidentCenter();
  const { panelProps, unreadCount, markReadQuiet } = notifications;
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const list = panelProps.notifications.filter(item => !unreadOnly || !item.is_read);

  function toggle(notice: Notice) {
    setExpanded(current => (current === notice.id ? null : notice.id));
    if (!notice.is_read) void markReadQuiet(notice.id);
  }

  const content = (
    <div className="coord-bell-panel">
      <header>
        <strong>Thông báo</strong>
        <Segmented
          size="small" value={unreadOnly ? 'unread' : 'all'} onChange={value => setUnreadOnly(value === 'unread')}
          options={[{ label: 'Tất cả', value: 'all' }, { label: `Chưa đọc (${unreadCount})`, value: 'unread' }]}
        />
      </header>
      <div className="coord-bell-list" role="list">
        {panelProps.loading && !list.length ? <div className="coord-bell-empty"><Spin /></div>
          : !list.length ? <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={unreadOnly ? 'Bạn đã đọc tất cả thông báo' : 'Chưa có thông báo'} />
          : list.map(notice => {
            const incident = isIncident(notice);
            const isOpen = expanded === notice.id;
            return (
              <div key={notice.id} role="listitem" className={'coord-bell-item' + (notice.is_read ? '' : ' is-unread') + (incident ? ' is-incident' : '') + (isOpen ? ' is-open' : '')}>
                <button type="button" className="coord-bell-row" aria-expanded={isOpen} onClick={() => toggle(notice)}>
                  <span className="coord-bell-icon" aria-hidden="true">{incident ? <ExclamationCircleFilled /> : <NotificationOutlined />}</span>
                  <span className="coord-bell-text">
                    {incident && <span className="coord-bell-kind">Sự cố cần xử lý</span>}
                    <span className="coord-bell-content">{notice.content}</span>
                    {notice.created_at && <small>{timeAgo(notice.created_at)}</small>}
                  </span>
                  {!notice.is_read && <span className="coord-bell-dot" aria-label="Chưa đọc" />}
                </button>
                {isOpen && incident && notice.related_id && (
                  <div className="coord-bell-actions">
                    <Button type="primary" danger size="small" onClick={() => { setOpen(false); goHandle(String(notice.related_id)); }}>Xử lý sự cố</Button>
                  </div>
                )}
              </div>
            );
          })}
      </div>
      <footer>
        {unreadCount > 0 && <Button type="link" size="small" onClick={panelProps.onMarkAllRead}>Đánh dấu tất cả đã đọc</Button>}
        <Button type="link" size="small" onClick={() => { setOpen(false); navigate(coordinatorPaths.notifications); }}>Xem tất cả</Button>
      </footer>
    </div>
  );

  return (
    <Popover
      open={open} onOpenChange={next => { setOpen(next); if (!next) setExpanded(null); }} trigger="click" placement="bottomRight"
      content={content} arrow={false} classNames={{ root: 'coord-bell-popover' }}
    >
      <Tooltip title={open ? undefined : 'Thông báo'}>
        <Badge count={unreadCount} size="small" offset={[-4, 4]} className="coord-bell-badge">
          <Button icon={<BellOutlined />} aria-label={`Thông báo${unreadCount ? ` (${unreadCount} chưa đọc)` : ''}`} />
        </Badge>
      </Tooltip>
    </Popover>
  );
}
