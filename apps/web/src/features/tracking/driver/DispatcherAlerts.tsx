import { Alert, Tag } from 'antd';
import type { IAlert } from '@my-project/shared';
import { ALERT_LABEL, formatDateTime } from '../tracking.format';
import { ALERT_COLOR } from './driver-ui';

/** Khung "Cảnh báo từ điều phối viên" (3 cảnh báo mới nhất). Chưa dùng ở UI-1; sẽ chuyển thành thông báo nổi. */
export default function DispatcherAlerts({ alerts }: { alerts: IAlert[] }) {
  if (!alerts.length) return null;
  return (
    <Alert
      type="warning" showIcon className="drv-alerts"
      message="Cảnh báo từ điều phối viên"
      description={(
        <ul>
          {[...alerts].reverse().slice(0, 3).map(alert => (
            <li key={alert.id}>
              <Tag color={ALERT_COLOR[alert.alertType]}>{ALERT_LABEL[alert.alertType] ?? alert.alertType}</Tag>
              <span>{alert.content}</span>
              <time dateTime={alert.sentAt}>{formatDateTime(alert.sentAt)} · {alert.sentByName}</time>
            </li>
          ))}
        </ul>
      )}
    />
  );
}
