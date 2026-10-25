import { Checkbox, Tag } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { IIncident, ITripContact } from '@my-project/shared';
import { INCIDENT_STATUS_LABEL, formatDateTime } from '../tracking.format';
import { INCIDENT_STATUS_COLOR, SEVERITY_SHORT, WAITING_STEPS, incidentKindLabel } from './driver-ui';
import { useDraft } from './useDraft';

/** "Trong lúc chờ": 3 việc an toàn, tick lưu theo chuyến. */
export function WaitingChecklist({ tripId }: { tripId: string }) {
  const [checked, setChecked] = useDraft<string[]>(`waiting:${tripId}`, []);
  return (
    <section className="drv-card drv-checklist" aria-labelledby="drv-waiting-title">
      <h3 id="drv-waiting-title" className="drv-card-title">Trong lúc chờ</h3>
      <Checkbox.Group value={checked} onChange={values => setChecked(values as string[])}>
        {WAITING_STEPS.map(item => <Checkbox key={item.id} value={item.id}>{item.label}</Checkbox>)}
      </Checkbox.Group>
    </section>
  );
}

/** "Liên hệ nhanh": gọi điều phối viên của chuyến và số cứu hộ; ẩn nút nào thiếu số. */
export function QuickContactCard({ coordinator, hotline }: { coordinator: ITripContact | null | undefined; hotline: string | null | undefined }) {
  const tel = (phone: string) => 'tel:' + phone.replace(/[^\d+]/g, '');
  return (
    <section className="drv-card drv-contacts" aria-labelledby="drv-contacts-title">
      <h3 id="drv-contacts-title" className="drv-card-title">Liên hệ nhanh</h3>
      {coordinator?.phone && <a className="drv-contact is-primary" href={tel(coordinator.phone)}>Gọi điều phối: {coordinator.name}</a>}
      {hotline && <a className="drv-contact" href={tel(hotline)}>Cứu hộ 24/7: {hotline}</a>}
      {!coordinator?.phone && !hotline && <p className="drv-muted">Chưa có số liên hệ cho chuyến này.</p>}
    </section>
  );
}

export function RedNotice() {
  return (
    <p className="drv-red-notice" role="note">
      <WarningOutlined aria-hidden="true" />
      <span>Mức đỏ sẽ gửi thông báo khẩn ngay tới điều phối viên.</span>
    </p>
  );
}

/** Sự cố đã báo của chuyến (mới nhất trước), có badge mức độ. */
export function ReportedIncidents({ incidents }: { incidents: IIncident[] }) {
  if (!incidents.length) return null;
  return (
    <section className="drv-card drv-reported-list" aria-labelledby="drv-reported-title">
      <h3 id="drv-reported-title" className="drv-card-title">Sự cố đã báo</h3>
      <ul>
        {[...incidents].reverse().slice(0, 5).map(item => (
          <li key={item.id}>
            <span className="drv-reported-head">
              {item.severity && <span className={'drv-sev-badge is-' + item.severity.toLowerCase()}>{SEVERITY_SHORT[item.severity]}</span>}
              <strong>{incidentKindLabel(item.incidentType, item.subType)}</strong>
              <Tag color={INCIDENT_STATUS_COLOR[item.status]}>{INCIDENT_STATUS_LABEL[item.status]}</Tag>
            </span>
            <span className="drv-reported-desc">{item.description}</span>
            <time dateTime={item.reportedAt}>{formatDateTime(item.reportedAt)}</time>
            {item.status === 'CLOSED' && item.handlingNote && <small>Xử lý: {item.handlingNote}</small>}
          </li>
        ))}
      </ul>
    </section>
  );
}
