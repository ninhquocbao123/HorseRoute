import { useState } from 'react';
import { Checkbox, Tag } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import type { IIncident, IncidentSeverity, ITripContact } from '@my-project/shared';
import { INCIDENT_STATUS_LABEL, formatDateTime } from '../tracking.format';
import { INCIDENT_SEVERITY_META } from '@my-project/shared';
import { WAITING_STEPS, incidentKindLabel, severityVars } from './driver-ui';
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

export function RedNotice({ severity }: { severity: IncidentSeverity | '' }) {
  if (severity !== 'RED') return null;
  return (
    <p className="drv-red-notice" role="note">
      <WarningOutlined aria-hidden="true" />
      <span>Mức nghiêm trọng sẽ gửi thông báo khẩn ngay tới điều phối viên.</span>
    </p>
  );
}

/** Một sự cố trong danh sách của tài xế: viền trái + tag mức độ theo màu mức độ, tag trạng thái trung tính cùng hàng tiêu đề. */
export function IncidentListItem({ item }: { item: IIncident }) {
  const [open, setOpen] = useState(false);
  const long = item.description.length > 110;
  return (
    <li className={item.severity ? 'has-severity' : undefined} style={item.severity ? severityVars(item.severity) : undefined}>
      <span className="drv-reported-head">
        <strong>{incidentKindLabel(item.incidentType, item.subType)}</strong>
        <Tag bordered={false} className="drv-status-tag">{INCIDENT_STATUS_LABEL[item.status]}</Tag>
      </span>
      {item.severity && <span className="drv-sev-tag">{INCIDENT_SEVERITY_META[item.severity].label}</span>}
      {long
        ? <button type="button" className={'drv-reported-desc is-toggle' + (open ? '' : ' is-clamped')} aria-expanded={open} onClick={() => setOpen(!open)}>{item.description}</button>
        : <span className="drv-reported-desc">{item.description}</span>}
      <time dateTime={item.reportedAt}>{formatDateTime(item.reportedAt)}</time>
      {(() => {
        // Phản hồi mới nhất của điều phối viên (hướng xử lý + giờ dự kiến xong, hoặc kết quả khi đã xử lý).
        const latest = item.responses?.[item.responses.length - 1];
        const note = latest?.note ?? item.handlingNote;
        if (!note) return null;
        return (
          <small className="drv-incident-reply">
            {item.status === 'CLOSED' ? 'Đã xử lý' : 'Điều phối'}: {note}
            {item.status !== 'CLOSED' && latest?.expectedAt && <> · dự kiến xong {formatDateTime(latest.expectedAt)}</>}
          </small>
        );
      })()}
    </li>
  );
}

/** Sự cố đã báo của chuyến (mới nhất trước). */
export function ReportedIncidents({ incidents }: { incidents: IIncident[] }) {
  if (!incidents.length) return null;
  return (
    <section className="drv-card drv-reported-list" aria-labelledby="drv-reported-title">
      <h3 id="drv-reported-title" className="drv-card-title">Sự cố đã báo</h3>
      <ul>
        {[...incidents].reverse().slice(0, 5).map(item => <IncidentListItem key={item.id} item={item} />)}
      </ul>
    </section>
  );
}
