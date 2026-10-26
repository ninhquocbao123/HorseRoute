// Thông báo nổi của khung tài xế (UI-2): góc trên phải, tối đa 3. `top` = 196px (dưới hàng đầu của thẻ chuyến) để không che nút Check-in / Báo cáo sự cố.
// - cảnh báo điều phối: KHÔNG tự tắt, có nút đóng; - thành công: tự tắt sau 5 giây; - cập nhật sự cố: tự tắt sau 8 giây.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { notification } from 'antd';
import { CheckCircleFilled, InfoCircleFilled, WarningFilled } from '@ant-design/icons';
import type { IAlert } from '@my-project/shared';
import { ALERT_LABEL } from '../tracking.format';

export const SUCCESS_SECONDS = 5;
export const INFO_SECONDS = 8;

export type AlertCard = Pick<IAlert, 'id' | 'alertType' | 'content' | 'sentByName' | 'sentAt'> & { more: number; onClose: () => void; onMore: () => void };

export type DriverNotice = {
  success: (content: string) => void;
  info: (title: string, description?: string) => void;
  /** Cảnh báo điều phối: giữ tới khi tài xế đóng; chỉ một thẻ, `more` = số cảnh báo chưa đóng còn lại. `onClose` chỉ gọi khi tài xế bấm đóng. */
  alert: (card: AlertCard) => void;
  /** Tắt thẻ cảnh báo đang hiện (không gọi onClose). */
  dismissAlert: (id: string) => void;
};

const NOOP: DriverNotice = { success: () => undefined, info: () => undefined, alert: () => undefined, dismissAlert: () => undefined };
const Context = createContext<DriverNotice>(NOOP);
export const useDriverNotice = () => useContext(Context);

const clock = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

export function DriverNoticeProvider({ children }: { children: ReactNode }) {
  const [api, holder] = notification.useNotification({ placement: 'topRight', top: 196, maxCount: 3, stack: false, showProgress: false, pauseOnHover: true });
  const value = useMemo<DriverNotice>(() => ({
    success: content => api.open({ key: 'ok:' + content, message: content, duration: SUCCESS_SECONDS, icon: <CheckCircleFilled className="drv-toast-ok" />, className: 'drv-toast is-success', role: 'status' }),
    info: (title, description) => api.open({ key: 'info:' + title, message: title, description, duration: INFO_SECONDS, icon: <InfoCircleFilled className="drv-toast-info" />, className: 'drv-toast', role: 'status' }),
    alert: card => api.open({
      key: 'alert:' + card.id, duration: 0, onClose: card.onClose, className: 'drv-toast is-alert', role: 'alert',
      icon: <WarningFilled className="drv-toast-warn" />,
      message: `Cảnh báo ${(ALERT_LABEL[card.alertType] ?? card.alertType).toLowerCase()}`,
      description: (
        <>
          <span className="drv-toast-text">{card.content}</span>
          <small className="drv-toast-meta">{clock.format(new Date(card.sentAt))} · {card.sentByName}</small>
          {card.more > 0 && <button type="button" className="drv-toast-more" onClick={card.onMore}>+{card.more} cảnh báo khác</button>}
        </>
      ),
    }),
    dismissAlert: id => api.destroy('alert:' + id),
  }), [api]);
  return <Context.Provider value={value}>{holder}{children}</Context.Provider>;
}
