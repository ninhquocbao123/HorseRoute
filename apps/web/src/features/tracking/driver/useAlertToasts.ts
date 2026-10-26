// Cảnh báo điều phối dạng thông báo nổi: chỉ cảnh báo CHƯA đóng của chuyến đang hoạt động; đã đóng thì không hiện lại
// (id lưu localStorage theo tài khoản). Không tự tắt; tối đa 3 cái hiển thị cùng lúc (cái mới nhất ở trên).
import { useCallback, useEffect, useRef } from 'react';
import type { IAlert } from '@my-project/shared';
import { trackingApi } from '../tracking.api';
import type { DriverNotice } from './DriverNotices';

const MAX_SHOWN = 3;
const MAX_STORED = 200;
const storeKey = (userId: string) => `wdp:tracking:alerts-closed:${userId}`;

function readClosed(userId: string): string[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(storeKey(userId)) ?? '[]');
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function writeClosed(userId: string, ids: string[]) {
  try {
    localStorage.setItem(storeKey(userId), JSON.stringify(ids.slice(-MAX_STORED)));
  } catch {
    // Bộ nhớ bị chặn: cảnh báo đã đóng có thể hiện lại ở lần tải sau.
  }
}

export function useAlertToasts(userId: string, tripId: string | null, notice: DriverNotice) {
  const shown = useRef(new Set<string>());
  const noticeRef = useRef(notice);
  noticeRef.current = notice;

  const show = useCallback((alert: Pick<IAlert, 'id' | 'alertType' | 'content' | 'sentByName' | 'sentAt'>) => {
    const id = String(alert.id);
    if (shown.current.has(id) || readClosed(userId).includes(id)) return;
    shown.current.add(id);
    noticeRef.current.alert({ ...alert, id }, () => {
      shown.current.delete(id);
      writeClosed(userId, [...readClosed(userId), id]);
    });
  }, [userId]);

  /** Tải cảnh báo của chuyến đang hoạt động và hiện những cái chưa đóng/chưa hiện (tối đa 3 mới nhất). */
  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const alerts = await trackingApi.alerts(tripId);
      const closed = readClosed(userId);
      const fresh = alerts.filter(alert => !closed.includes(String(alert.id)) && !shown.current.has(String(alert.id)));
      fresh.slice(-MAX_SHOWN).forEach(show);
    } catch {
      // Mất mạng: lần polling/kết nối lại sau sẽ thử lại.
    }
  }, [tripId, userId, show]);

  useEffect(() => { shown.current.clear(); void load(); }, [load]);

  return { load, show };
}
