import {useFeedback} from '../../components/useFeedback';
import { useCallback, useEffect, useState } from 'react';
import { App } from 'antd';
import { api } from '../../lib/axios';
import type { Notice } from './NotificationsPanel';

/** Dữ liệu và thao tác cho NotificationsPanel (tải danh sách, đánh dấu đã đọc). */
export function useNotifications(accountId: string) {
  const { message } = useFeedback();
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
      void message.success({ key: 'notifications-feedback', content: 'Đã đánh dấu thông báo là đã đọc.' });
    } catch {
      void message.error({ key: 'notifications-feedback', content: 'Chưa thể đánh dấu thông báo. Hãy thử lại.', duration: 5 });
    } finally {
      setMarkingId(null);
    }
  }

  useEffect(() => {
    void refresh();
  }, [accountId, refresh]);

  return {
    panelProps: {
      notifications, loading, error, unreadOnly, markingId,
      onUnreadChange: setUnreadOnly,
      onRefresh: () => void refresh(),
      onMarkRead: (id: string) => void markRead(id),
    },
    unreadCount: notifications.filter(item => !item.is_read).length,
  };
}
