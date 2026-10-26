// Cảnh báo điều phối dạng thông báo nổi: MỘT thẻ duy nhất (cảnh báo chưa đóng mới nhất) + dòng "+N cảnh báo khác".
// Chỉ cảnh báo CHƯA đóng của chuyến đang hoạt động; đã đóng thì không hiện lại (id lưu localStorage theo tài khoản).
// Chống trùng theo alertId: socket + polling + kết nối lại có phát/tải cùng một cảnh báo nhiều lần cũng chỉ một thẻ.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IAlert } from '@my-project/shared';
import { trackingApi } from '../tracking.api';
import type { DriverNotice } from './DriverNotices';

const MAX_STORED = 200;
const storeKey = (userId: string) => `wdp:tracking:alerts-closed:${userId}`;
export type AlertLike = Pick<IAlert, 'id' | 'alertType' | 'content' | 'sentByName' | 'sentAt'>;

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

const newest = (a: AlertLike, b: AlertLike) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || Number(a.id) - Number(b.id);

export function useAlertToasts(userId: string, tripId: string | null, notice: DriverNotice, onMore: () => void) {
  const queue = useRef(new Map<string, AlertLike>());
  /** Cảnh báo chưa đóng, mới nhất trước (cho danh sách trong drawer). */
  const [openAlerts, setOpenAlerts] = useState<AlertLike[]>([]);
  const shown = useRef<{ id: string; more: number } | null>(null);
  const noticeRef = useRef(notice);
  noticeRef.current = notice;
  const moreRef = useRef(onMore);
  moreRef.current = onMore;

  const closeRef = useRef<(id: string) => void>(() => undefined);
  const closeAlert = (id: string) => closeRef.current(id);

  const render = useCallback(() => {
    const open = [...queue.current.values()].sort(newest);
    setOpenAlerts([...open].reverse());
    const top = open[open.length - 1];
    if (!top) {
      if (shown.current) noticeRef.current.dismissAlert(shown.current.id);
      shown.current = null;
      return;
    }
    const more = open.length - 1;
    if (shown.current?.id === top.id && shown.current.more === more) return;
    if (shown.current && shown.current.id !== top.id) noticeRef.current.dismissAlert(shown.current.id);
    shown.current = { id: top.id, more };
    noticeRef.current.alert({
      ...top, more,
      onClose: () => {
        shown.current = null; // thẻ đã tự đóng: không cần tắt lại
        closeAlert(top.id);
      },
      onMore: () => moreRef.current(),
    });
  }, [userId]);

  /** Đóng một cảnh báo (nút trên thẻ hoặc trong danh sách): ghi nhớ đã đóng, hiện cảnh báo kế tiếp. */
  closeRef.current = (id: string) => {
    writeClosed(userId, [...readClosed(userId), id]);
    queue.current.delete(id);
    render();
  };

  const add = useCallback((alert: AlertLike) => {
    const id = String(alert.id);
    if (queue.current.has(id) || readClosed(userId).includes(id)) return false;
    queue.current.set(id, { ...alert, id });
    return true;
  }, [userId]);

  /** Cảnh báo mới từ socket. */
  const show = useCallback((alert: AlertLike) => { if (add(alert)) render(); }, [add, render]);

  /** Tải cảnh báo của chuyến đang hoạt động (mở trang, polling, kết nối lại). */
  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const alerts = await trackingApi.alerts(tripId);
      let changed = false;
      for (const alert of alerts) changed = add(alert) || changed;
      if (changed) render();
    } catch {
      // Mất mạng: lần polling/kết nối lại sau sẽ thử lại.
    }
  }, [tripId, add, render]);

  useEffect(() => {
    if (shown.current) noticeRef.current.dismissAlert(shown.current.id);
    queue.current.clear();
    shown.current = null;
    void load();
  }, [load]);

  return { load, show, openAlerts, close: closeAlert };
}
