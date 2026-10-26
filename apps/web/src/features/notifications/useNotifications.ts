import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { api } from '../../lib/axios';
import type { Notice } from './NotificationsPanel';

/** Dữ liệu và thao tác cho NotificationsPanel (tải danh sách, đánh dấu đã đọc). */
export function useNotifications(accountId: string) {
  const { message } = App.useApp();
  const [notifications, setNotifications] = useState<Notice[]>([]);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [unreadOnly, setUnreadOnly] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get<Notice[]>('/notifications');
      setNotifications(data);
      setError('');
    } catch {
      setError('Không tải được thông báo. Vui lòng thử lại.');
    } finally {
      setLoading(false);
    }
  }, []);

  async function markRead(id: string) {
    if (markingId) return;
    setMarkingId(id);
    try {
      await api.post('/notifications/' + id + '/read');
      setNotifications(items => items.map(item => (item.id === id ? { ...item, is_read: 1 } : item)));
    } catch {
      void message.error({ key: 'notifications-feedback', content: 'Chưa thể đánh dấu thông báo. Hãy thử lại.', duration: 5 });
    } finally {
      setMarkingId(null);
    }
  }

  /** Đánh dấu tất cả đã đọc bằng API sẵn có (từng thông báo chưa đọc); cái nào lỗi thì giữ chưa đọc. */
  async function markAllRead() {
    const ids = notifications.filter(item => !item.is_read).map(item => item.id);
    if (!ids.length) return;
    const results = await Promise.allSettled(ids.map(id => api.post('/notifications/' + id + '/read')));
    const done = new Set(ids.filter((_, index) => results[index].status === 'fulfilled'));
    setNotifications(items => items.map(item => (done.has(item.id) ? { ...item, is_read: 1 } : item)));
    if (done.size < ids.length) void message.error({ key: 'notifications-feedback', content: 'Một số thông báo chưa đánh dấu được. Hãy thử lại.', duration: 5 });
  }

  /** Có thông báo mới từ socket: thêm vào đầu danh sách (bỏ qua nếu đã có) để badge chuông tăng ngay. */
  const addNotice = useCallback((notice: { id: string; content: string; createdAt: string; eventType?: string }) => {
    setNotifications(items => (items.some(item => item.id === String(notice.id))
      ? items
      : [{ id: String(notice.id), content: notice.content, is_read: 0, created_at: notice.createdAt, event_type: notice.eventType, related_type: 'TRIP' }, ...items]));
  }, []);

  useEffect(() => {
    void refresh();
  }, [accountId, refresh]);

  return {
    panelProps: {
      notifications, loading, error, unreadOnly, markingId,
      onUnreadChange: setUnreadOnly,
      onRefresh: () => void refresh(),
      onMarkRead: (id: string) => void markRead(id),
      onMarkAllRead: () => void markAllRead(),
    },
    addNotice,
    refresh,
    unreadCount: notifications.filter(item => !item.is_read).length,
  };
}
