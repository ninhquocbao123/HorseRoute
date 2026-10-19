import { useCallback, useEffect, useState } from 'react';
import type { ITripTimeline, ITripTimelineLeg } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';
import { CONDITION_LABEL, LEG_STATUS_LABEL, MILESTONE_LABEL, ORDER_STATUS_LABEL, formatDateTime } from '../tracking.format';
import AttachmentImage from '../AttachmentImage';
import CorrectLegDialog from './CorrectLegDialog';
import IncidentsTab from './IncidentsTab';
import AlertsTab from './AlertsTab';

type Tab = 'progress' | 'incidents' | 'horse-logs' | 'alerts';

function LegRow({ leg, canCorrect, onCorrect }: { leg: ITripTimelineLeg; canCorrect: boolean; onCorrect: () => void }) {
  return (
    <li className={leg.isOverdue ? 'is-late' : ''}>
      <div className="trk-leg-head">
        <strong>Chặng {leg.seqNo}: {leg.fromLocationName} → {leg.toLocationName}</strong>
        <span className="status-chip" data-status={leg.status}>{LEG_STATUS_LABEL[leg.status]}</span>
      </div>
      <dl className="trk-facts">
        <div><dt>Kế hoạch đi</dt><dd>{formatDateTime(leg.plannedDepartureAt)}</dd></div>
        <div><dt>Thực tế đi</dt><dd>{formatDateTime(leg.actualDepartureAt)}</dd></div>
        <div><dt>Kế hoạch đến</dt><dd>{formatDateTime(leg.plannedArrivalAt)}</dd></div>
        <div><dt>Thực tế đến</dt><dd>{formatDateTime(leg.actualArrivalAt)}</dd></div>
      </dl>
      {leg.isOverdue && <p className="trk-late">Quá giờ đến dự kiến mà chặng chưa hoàn thành.</p>}
      {leg.milestones.length > 0 ? (
        <ul className="trk-milestones">
          {leg.milestones.map(m => (
            <li key={m.id}><span>{MILESTONE_LABEL[m.milestoneType]} · {m.recordedByName}</span><time dateTime={m.occurredAt}>{formatDateTime(m.occurredAt)}</time></li>
          ))}
        </ul>
      ) : (
        <p className="trk-muted">Chưa có mốc nào.</p>
      )}
      {leg.updatedAt && <p className="trk-updated">Cập nhật lần cuối lúc {formatDateTime(leg.updatedAt)}{leg.updatedByName ? ` bởi ${leg.updatedByName}` : ''}</p>}
      {canCorrect && <div className="trk-row-actions"><button type="button" className="trk-secondary" onClick={onCorrect}>Hiệu chỉnh mốc</button></div>}
    </li>
  );
}

export default function TripDetailPanel({ tripId, role, onChanged }: { tripId: string; role: string; onChanged: () => void }) {
  const [timeline, setTimeline] = useState<ITripTimeline | null>(null);
  const [tab, setTab] = useState<Tab>('progress');
  const [horseFilter, setHorseFilter] = useState('');
  const [correcting, setCorrecting] = useState<ITripTimelineLeg | null>(null);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setTimeline(await trackingApi.tripTimeline(tripId));
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Không tải được tiến độ chuyến.'));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    setLoading(true);
    setTimeline(null);
    setNotice('');
    setTab('progress');
    void load();
  }, [load]);

  const specialist = role === 'SPECIALIST';
  const coordinator = role === 'COORDINATOR';
  const operable = timeline ? ['READY', 'IN_TRANSIT', 'DELIVERED'].includes(timeline.orderStatus) && timeline.planStatus === 'APPROVED' : false;
  const canCorrect = (coordinator || role === 'MANAGER') && operable;
  const canAlert = coordinator && timeline ? ['READY', 'IN_TRANSIT'].includes(timeline.orderStatus) : false;

  async function afterChange(message: string) {
    setNotice(message);
    await load();
    onChanged();
  }

  if (loading) return <p role="status">Đang tải chi tiết chuyến…</p>;
  if (error && !timeline) return <p className="error" role="alert">{error} <button type="button" className="trk-link" onClick={() => { setLoading(true); void load(); }}>Thử lại</button></p>;
  if (!timeline) return null;

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: 'progress', label: 'Tiến độ' },
    ...(specialist ? [] : [{ id: 'incidents' as Tab, label: 'Sự cố hành trình', count: timeline.incidents.filter(i => i.status !== 'CLOSED').length }]),
    { id: 'horse-logs', label: 'Nhật ký ngựa', count: timeline.horseLogs.length },
    { id: 'alerts', label: 'Cảnh báo', count: timeline.alerts.length },
  ];
  const horses = [...new Map(timeline.horseLogs.map(log => [log.horseId, log.horseName])).entries()];
  const logs = timeline.horseLogs.filter(log => !horseFilter || log.horseId === horseFilter);

  return (
    <section className="portal-panel trk-panel trk-detail" aria-label={`Chi tiết chuyến ${timeline.orderCode}`}>
      <div className="portal-panel-heading">
        <div>
          <h2>{timeline.orderCode} · Chuyến #{timeline.tripId}</h2>
          <p className="trk-muted">
            {formatDateTime(timeline.plannedDepartureAt)} → {formatDateTime(timeline.plannedArrivalAt)}
            {timeline.lastUpdatedAt ? ` · Cập nhật lần cuối lúc ${formatDateTime(timeline.lastUpdatedAt)}${timeline.lastUpdatedByName ? ` bởi ${timeline.lastUpdatedByName}` : ''}` : ''}
          </p>
        </div>
        <span className="status-chip" data-status={timeline.orderStatus}>{ORDER_STATUS_LABEL[timeline.orderStatus] ?? timeline.orderStatus}</span>
      </div>

      {notice && <p className="trk-notice" role="status">{notice}</p>}
      {error && <p className="error" role="alert">{error}</p>}

      <div className="portal-tabs trk-tabs" role="tablist">
        {tabs.map(item => (
          <button key={item.id} type="button" role="tab" aria-pressed={tab === item.id} aria-selected={tab === item.id} onClick={() => setTab(item.id)}>
            {item.label}{item.count ? ` (${item.count})` : ''}
          </button>
        ))}
      </div>

      {tab === 'progress' && (
        <>
          {specialist && <p className="trk-hint">Bạn xem ở chế độ chỉ đọc.</p>}
          {timeline.legs.length === 0
            ? <p className="trk-muted">Chuyến chưa có chặng nào.</p>
            : <ol className="trk-legs">{timeline.legs.map(leg => <LegRow key={leg.id} leg={leg} canCorrect={canCorrect} onCorrect={() => setCorrecting(leg)} />)}</ol>}
        </>
      )}

      {tab === 'incidents' && !specialist && (
        <IncidentsTab incidents={timeline.incidents} canHandle={coordinator} onChanged={afterChange} />
      )}

      {tab === 'horse-logs' && (
        <>
          {horses.length > 1 && (
            <label className="trk-field trk-filter">
              Lọc theo ngựa
              <select value={horseFilter} onChange={event => setHorseFilter(event.target.value)}>
                <option value="">Tất cả ngựa</option>
                {horses.map(([id, name]) => <option key={id} value={id}>{name}</option>)}
              </select>
            </label>
          )}
          {logs.length === 0 ? (
            <p className="trk-muted">Chưa có nhật ký sức khỏe nào.</p>
          ) : (
            <ul className="trk-log-list">
              {[...logs].reverse().map(log => (
                <li key={log.id}>
                  <div className="trk-leg-head">
                    <strong>{log.horseName}</strong>
                    <span className="status-chip" data-status={log.conditionStatus}>{CONDITION_LABEL[log.conditionStatus]}</span>
                  </div>
                  <p className="trk-muted">{formatDateTime(log.loggedAt)} · {log.createdByName}{log.correctsLogId ? ` · đính chính bản #${log.correctsLogId}` : ''}</p>
                  {log.note && <p>{log.note}</p>}
                  {log.attachments.length > 0 && <div className="trk-thumbs">{log.attachments.map(a => <AttachmentImage key={a.id} id={a.id} name={a.originalName} />)}</div>}
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      {tab === 'alerts' && <AlertsTab tripId={tripId} alerts={timeline.alerts} canSend={canAlert} onSent={afterChange} />}

      {correcting && (
        <CorrectLegDialog
          leg={correcting}
          onClose={() => setCorrecting(null)}
          onDone={message => {
            setCorrecting(null);
            void afterChange(message);
          }}
        />
      )}
    </section>
  );
}
