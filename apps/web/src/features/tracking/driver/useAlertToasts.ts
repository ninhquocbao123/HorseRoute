// Cảnh báo điều phối dạng thông báo nổi (góc dưới phải): MỘT thẻ duy nhất (cảnh báo chưa đọc mới nhất) + dòng "+N cảnh báo khác".
// Mỗi toast ứng với MỘT thông báo (bảng notifications): chỉ cảnh báo có thông báo CHƯA ĐỌC của chính người xem mới có toast.
// - Bấm X trên thẻ / trong danh sách = đánh dấu đã đọc thông báo đó (badge chuông giảm ngay).
// - Bấm thân thẻ = mở bảng thông báo và đánh dấu đã đọc.
// - Thông báo được đọc ở nơi khác (bảng chuông) thì thẻ tự biến mất (`sync`).
// Chống trùng theo alertId: socket + polling + kết nối lại có tải cùng một cảnh báo nhiều lần cũng chỉ một thẻ.
import { useCallback, useEffect, useRef, useState } from 'react';
import type { IAlert } from '@my-project/shared';
import { trackingApi } from '../tracking.api';
import type { DriverNotice } from './DriverNotices';

export type AlertLike = Pick<IAlert, 'id' | 'alertType' | 'content' | 'sentByName' | 'sentAt'> & { notificationId: string };

const newest = (a: AlertLike, b: AlertLike) => Date.parse(a.sentAt) - Date.parse(b.sentAt) || Number(a.id) - Number(b.id);

export type AlertToastActions = {
  /** Đánh dấu đã đọc một thông báo (POST /notifications/:id/read, cập nhật lạc quan ở chuông). */
  markRead: (notificationId: string) => void;
  /** Mở bảng thông báo (drawer chuông). */
  openPanel: () => void;
};

export function useAlertToasts(userId: string, tripId: string | null, notice: DriverNotice, onMore: () => void, actions: AlertToastActions) {
  const queue = useRef(new Map<string, AlertLike>());
  /** Cảnh báo chưa đọc, mới nhất trước (cho danh sách trong drawer). */
  const [openAlerts, setOpenAlerts] = useState<AlertLike[]>([]);
  const shown = useRef<{ id: string; more: number } | null>(null);
  /** Danh sách đang mở: tạm ẩn thẻ nổi để khỏi che danh sách; đóng danh sách thì hiện lại. */
  const paused = useRef(false);
  const noticeRef = useRef(notice);
  noticeRef.current = notice;
  const moreRef = useRef(onMore);
  moreRef.current = onMore;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  /** Thông báo đã đánh dấu đọc trong phiên này: kết quả /alerts tải về chậm hơn không được làm toast hiện lại. */
  const readIds = useRef(new Set<string>());

  const closeRef = useRef<(id: string) => void>(() => undefined);
  const closeAlert = (id: string) => closeRef.current(id);

  const render = useCallback(() => {
    const open = [...queue.current.values()].sort(newest);
    setOpenAlerts([...open].reverse());
    const top = open[open.length - 1];
    if (paused.current || !top) {
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
      onOpen: () => {
        noticeRef.current.dismissAlert(top.id);
        shown.current = null;
        closeAlert(top.id);
        actionsRef.current.openPanel();
      },
      onMore: () => {
        paused.current = true;
        noticeRef.current.dismissAlert(top.id);
        shown.current = null;
        moreRef.current();
      },
    });
  }, [userId]);

  /** Đóng một cảnh báo (X trên thẻ, trong danh sách, hoặc bấm thân thẻ): đánh dấu đã đọc, hiện cảnh báo kế tiếp. */
  closeRef.current = (id: string) => {
    const alert = queue.current.get(id);
    queue.current.delete(id);
    if (alert) {
      readIds.current.add(alert.notificationId);
      actionsRef.current.markRead(alert.notificationId);
    }
    render();
  };

  /** Chỉ cảnh báo có thông báo chưa đọc mới thành toast; trả true khi hàng đợi đổi. */
  const add = useCallback((alert: IAlert) => {
    const id = String(alert.id);
    if (!alert.notificationId || alert.notificationRead || readIds.current.has(alert.notificationId) || queue.current.has(id)) return false;
    queue.current.set(id, { id, alertType: alert.alertType, content: alert.content, sentByName: alert.sentByName, sentAt: alert.sentAt, notificationId: alert.notificationId });
    return true;
  }, []);

  /** Tải cảnh báo của chuyến đang hoạt động (mở trang, socket, polling, kết nối lại). */
  const load = useCallback(async () => {
    if (!tripId) return;
    try {
      const alerts = await trackingApi.alerts(tripId);
      let changed = false;
      for (const alert of alerts) changed = add(alert) || changed;
      // Thông báo đã đọc ở nơi khác (tab khác, bảng chuông): bỏ toast tương ứng.
      for (const alert of alerts) {
        if (alert.notificationRead && queue.current.delete(String(alert.id))) changed = true;
      }
      if (changed) render();
    } catch {
      // Mất mạng: lần polling/kết nối lại sau sẽ thử lại.
    }
  }, [tripId, add, render]);

  /** Danh sách thông báo của chuông thay đổi: thông báo nào đã đọc thì bỏ toast của nó. */
  const sync = useCallback((readNotificationIds: Set<string>) => {
    let changed = false;
    for (const [id, alert] of queue.current) {
      if (readNotificationIds.has(alert.notificationId)) { queue.current.delete(id); changed = true; }
    }
    if (changed) render();
  }, [render]);

  useEffect(() => {
    if (shown.current) noticeRef.current.dismissAlert(shown.current.id);
    queue.current.clear();
    shown.current = null;
    void load();
  }, [load]);

  /** Đóng danh sách cảnh báo: hiện lại thẻ nổi (cảnh báo chưa đọc mới nhất). */
  const resume = useCallback(() => { paused.current = false; render(); }, [render]);

  return { load, sync, openAlerts, close: closeAlert, resume };
}
