// Thông báo nổi của khung tài xế (UI-2): góc trên phải, tối đa 3. `top` = 196px (dưới hàng đầu của thẻ chuyến) để không che nút Check-in / Báo cáo sự cố.
// - cảnh báo điều phối: KHÔNG tự tắt, có nút đóng; - thành công: tự tắt sau 5 giây; - cập nhật sự cố: tự tắt sau 8 giây.
import { createContext, useContext, useMemo, type ReactNode } from 'react';
import { notification } from 'antd';
import { CheckCircleFilled, InfoCircleFilled, WarningFilled } from '@ant-design/icons';
import type { IAlert } from '@my-project/shared';
import { ALERT_LABEL } from '../tracking.format';

export const SUCCESS_SECONDS = 5;
export const INFO_SECONDS = 8;

export type DriverNotice = {
  success: (content: string) => void;
  info: (title: string, description?: string) => void;
  /** Cảnh báo điều phối: giữ tới khi tài xế đóng; `onClose` gọi khi tài xế bấm đóng. */
  alert: (alert: Pick<IAlert, 'id' | 'alertType' | 'content' | 'sentByName' | 'sentAt'>, onClose: () => void) => void;
};

const NOOP: DriverNotice = { success: () => undefined, info: () => undefined, alert: () => undefined };
const Context = createContext<DriverNotice>(NOOP);
export const useDriverNotice = () => useContext(Context);

const clock = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });

export function DriverNoticeProvider({ children }: { children: ReactNode }) {
  const [api, holder] = notification.useNotification({ placement: 'topRight', top: 196, maxCount: 3, stack: false, showProgress: false, pauseOnHover: true });
  const value = useMemo<DriverNotice>(() => ({
    success: content => api.open({ key: 'ok:' + content, message: content, duration: SUCCESS_SECONDS, icon: <CheckCircleFilled className="drv-toast-ok" />, className: 'drv-toast is-success', role: 'status' }),
    info: (title, description) => api.open({ key: 'info:' + title, message: title, description, duration: INFO_SECONDS, icon: <InfoCircleFilled className="drv-toast-info" />, className: 'drv-toast', role: 'status' }),
    alert: (alert, onClose) => api.open({
      key: 'alert:' + alert.id, duration: 0, onClose, className: 'drv-toast is-alert', role: 'alert',
      icon: <WarningFilled className="drv-toast-warn" />,
      message: `Cảnh báo ${(ALERT_LABEL[alert.alertType] ?? alert.alertType).toLowerCase()}`,
      description: (
        <>
          <span className="drv-toast-text">{alert.content}</span>
          <small className="drv-toast-meta">{clock.format(new Date(alert.sentAt))} · {alert.sentByName}</small>
        </>
      ),
    }),
  }), [api]);
  return <Context.Provider value={value}>{holder}{children}</Context.Provider>;
}
