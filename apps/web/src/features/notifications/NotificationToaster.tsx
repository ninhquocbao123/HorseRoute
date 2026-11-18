import { useCallback, useEffect, useRef } from 'react';
import { notification } from 'antd';
import { InfoCircleFilled, WarningFilled } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/hooks/useAuth';
import { api } from '../../lib/axios';
import { connectSocket } from '../../lib/socket';
import { getAccessToken } from '../../lib/auth-storage';
import { isIncidentNotice, noticeLink, noticeTitle, publishNoticeChange, type LiveNotice } from './notice-meta';
import './notification-toaster.css';

const NORMAL_SECONDS = 6;
const clock = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

/** Cảnh báo điều phối gửi tổ lái: giữ tới khi tắt như sự cố, nhưng tông xanh. */
const STICKY = new Set(['TRIP_ALERT']);

/**
 * Toast thông báo realtime cho MỌI vai trò trên web: góc trên phải, tối đa 4 thẻ xếp dọc, rê chuột thì dừng đếm giờ.
 * Thường: tông xanh, tự ẩn sau 6 giây. Sự cố: viền đỏ, nền đỏ nhạt, icon cảnh báo, giữ tới khi tắt.
 * Bấm thẻ: mở trang liên quan và đánh dấu đã đọc. Chỉ hiện thông báo đến qua socket sau khi trang mở (không hiện lại thông báo cũ khi tải lại).
 */
export function NotificationToaster() {
  const { account } = useAuth();
  const navigate = useNavigate();
  const [toast, holder] = notification.useNotification({ placement: 'topRight', top: 16, maxCount: 4, stack: false, pauseOnHover: true, showProgress: true });
  const seen = useRef(new Set<string>());
  const role = account?.role ?? '';

  const open = useCallback(async (notice: LiveNotice) => {
    toast.destroy('notice:' + notice.id);
    navigate(noticeLink(role, notice));
    try { await api.post('/notifications/' + notice.id + '/read'); } catch { /* bảng chuông vẫn còn thông báo chưa đọc để thử lại */ }
    publishNoticeChange();
  }, [toast, navigate, role]);

  const show = useCallback((notice: LiveNotice) => {
    if (seen.current.has(notice.id)) return;
    seen.current.add(notice.id);
    publishNoticeChange();
    const incident = isIncidentNotice(notice.eventType);
    toast.open({
      key: 'notice:' + notice.id,
      duration: incident || STICKY.has(notice.eventType ?? '') ? 0 : NORMAL_SECONDS,
      className: incident ? 'hr-toast is-incident' : 'hr-toast',
      role: incident ? 'alert' : 'status',
      icon: incident ? <WarningFilled className="hr-toast-icon" /> : <InfoCircleFilled className="hr-toast-icon" />,
      title: noticeTitle(notice.eventType),
      description: (
        <>
          <span className="hr-toast-text">{notice.content}</span>
          <time className="hr-toast-time" dateTime={notice.createdAt}>{clock.format(new Date(notice.createdAt))}</time>
        </>
      ),
      onClick: () => void open(notice),
    });
  }, [toast, open, role]);

  useEffect(() => {
    if (!account || !getAccessToken()) return;
    const socket = connectSocket();
    const handler = (payload: LiveNotice) => show({ ...payload, id: String(payload.id) });
    socket.on('notification:new', handler);
    return () => { socket.off('notification:new', handler); };
  }, [account, show]);

  useEffect(() => { if (!account) toast.destroy(); }, [account, toast]);
  return holder;
}
