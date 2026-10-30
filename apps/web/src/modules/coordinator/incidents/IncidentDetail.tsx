import { EnvironmentOutlined, ExclamationCircleFilled, UserOutlined } from '@ant-design/icons';
import type { ICoordinatorIncident, IIncident } from '@my-project/shared';
import AttachmentImage from '../../../features/tracking/AttachmentImage';
import { formatDateTime } from '../../../features/tracking/tracking.format';
import { REPORTER_ROLE, STATUS_TEXT, incidentTitle, mapsLink, minutesText, severityOf } from './incident-ui';

const DAMAGE: Record<string, string> = { VEHICLE: 'Xe', HORSE: 'Ngựa', BOTH: 'Cả xe và ngựa' };

/** Đầu thẻ sự cố: icon chấm than theo màu mức độ, tiêu đề in đậm, chip mức độ + trạng thái. */
export function IncidentHeading({ incident }: { incident: IIncident }) {
  const sev = severityOf(incident);
  return (
    <div className="coord-inc-heading" style={{ '--sev': sev.color, '--sev-soft': sev.soft, '--sev-text': sev.text } as React.CSSProperties}>
      <span className="coord-inc-icon" aria-hidden="true"><ExclamationCircleFilled /></span>
      <div>
        <h2>{incidentTitle(incident)}</h2>
        <div className="coord-inc-chips">
          <span className="coord-inc-sev">{sev.label}</span>
          {incident.urgency === 'HIGH' && <span className="coord-inc-urgent">KHẨN</span>}
          <span className={'coord-inc-status is-' + incident.status.toLowerCase()}>{STATUS_TEXT[incident.status]}</span>
        </div>
      </div>
    </div>
  );
}

/** Thông tin đầy đủ của một sự cố: dùng trong modal và trang Xử lý sự cố. */
export function IncidentFacts({ incident }: { incident: IIncident | ICoordinatorIncident }) {
  const coordinatorView = 'orderCode' in incident ? incident : null;
  const map = mapsLink(incident);
  return (
    <div className="coord-inc-facts">
      <dl>
        {coordinatorView && <div><dt>Đơn</dt><dd><strong>{coordinatorView.orderCode}</strong>{coordinatorView.routeLabel && <small>{coordinatorView.routeLabel}</small>}</dd></div>}
        <div>
          <dt>Người báo</dt>
          <dd><UserOutlined /> {incident.reportedByName}{coordinatorView?.reporterRole && ` · ${REPORTER_ROLE[coordinatorView.reporterRole]}`}</dd>
        </div>
        <div><dt>Thời điểm</dt><dd>{formatDateTime(incident.reportedAt)}</dd></div>
        {incident.damageTarget && <div><dt>Hư hại</dt><dd>{DAMAGE[incident.damageTarget] ?? incident.damageTarget}</dd></div>}
        {incident.horseName && <div><dt>Ngựa</dt><dd>{incident.horseName}</dd></div>}
        {(incident.locationText || map) && (
          <div>
            <dt>Vị trí</dt>
            <dd>
              <EnvironmentOutlined /> {incident.locationText ?? `${incident.latitude}, ${incident.longitude}`}
              {map && <a href={map} target="_blank" rel="noreferrer"> · Mở bản đồ</a>}
            </dd>
          </div>
        )}
      </dl>
      <section className="coord-inc-desc">
        <h3>Mô tả của {coordinatorView?.reporterRole ? REPORTER_ROLE[coordinatorView.reporterRole].toLowerCase() : 'tổ lái'}</h3>
        <p>{incident.description}</p>
      </section>
      {incident.attachments.length > 0 && (
        <section className="coord-inc-photos">
          <h3>Ảnh hiện trường ({incident.attachments.length})</h3>
          <div>{incident.attachments.map(photo => <AttachmentImage key={photo.id} id={photo.id} name={photo.caption ?? photo.originalName} />)}</div>
        </section>
      )}
    </div>
  );
}

/** Lịch sử xử lý: báo cáo → các lần gửi hướng xử lý → đã xử lý. */
export function IncidentHistory({ incident }: { incident: IIncident }) {
  return (
    <ol className="coord-inc-history">
      <li className="is-report">
        <time>{formatDateTime(incident.reportedAt)}</time>
        <strong>{incident.reportedByName} báo sự cố</strong>
      </li>
      {(incident.responses ?? []).map(item => (
        <li key={item.id} className={item.kind === 'RESOLVED' ? 'is-resolved' : 'is-response'}>
          <time>{formatDateTime(item.sentAt)}</time>
          <strong>{item.kind === 'RESOLVED' ? 'Đã xử lý xong' : 'Gửi hướng xử lý'} · {item.sentByName}</strong>
          <p>{item.note}</p>
          {item.waitMinutes && item.expectedAt && <small>Thời gian chờ ~{minutesText(item.waitMinutes)} · dự kiến xong {formatDateTime(item.expectedAt)}</small>}
        </li>
      ))}
    </ol>
  );
}
