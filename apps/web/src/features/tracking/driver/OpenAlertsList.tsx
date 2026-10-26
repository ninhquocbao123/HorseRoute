// Danh sách cảnh báo điều phối CHƯA đóng (lấy từ hàng đợi cảnh báo: /alerts + socket), mở từ "+N cảnh báo khác".
// Không phụ thuộc bảng thông báo nên đủ N cảnh báo, kể cả cảnh báo gửi trước khi tài xế đăng nhập.
import { Button, Tag } from 'antd';
import { CloseOutlined } from '@ant-design/icons';
import { ALERT_LABEL, formatDateTime } from '../tracking.format';
import { ALERT_COLOR } from './driver-ui';
import type { AlertLike } from './useAlertToasts';

export function OpenAlertsList({ alerts, onClose }: { alerts: AlertLike[]; onClose: (id: string) => void }) {
  return (
    <section className="drv-alert-list" aria-labelledby="drv-alert-list-title">
      <h3 id="drv-alert-list-title">Cảnh báo điều phối</h3>
      {alerts.length === 0 ? <p className="drv-muted">Không còn cảnh báo chưa đóng.</p> : (
        <ul>
          {alerts.map(alert => (
            <li key={alert.id}>
              <div>
                <Tag color={ALERT_COLOR[alert.alertType]} bordered={false}>{ALERT_LABEL[alert.alertType] ?? alert.alertType}</Tag>
                <span className="drv-alert-text">{alert.content}</span>
                <small>{formatDateTime(alert.sentAt)} · {alert.sentByName}</small>
              </div>
              <Button type="text" size="small" shape="circle" icon={<CloseOutlined />} aria-label={`Đóng cảnh báo: ${alert.content}`} onClick={() => onClose(alert.id)} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
