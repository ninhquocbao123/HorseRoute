import { useCallback, useEffect, useRef, useState } from 'react';
import type { IActiveTrips } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';
import { LEG_STATUS_LABEL, ORDER_STATUS_LABEL, formatDateTime } from '../tracking.format';
import TripDetailPanel from './TripDetailPanel';

const REFRESH_MS = 60_000;

/** Dashboard vận hành dùng chung cho Manager, Coordinator và Specialist (chỉ đọc); quyền thao tác do backend và `role` quyết định. */
export default function OperationsWorkspace({ role }: { role: string }) {
  const [data, setData] = useState<IActiveTrips | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const detail = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    try {
      const result = await trackingApi.activeTrips();
      setData(result);
      setError('');
      // Giữ chuyến đang chọn nếu còn trong danh sách; nếu chưa chọn thì chọn chuyến đầu (khẩn cấp nhất).
      setSelectedId(current => (current && result.items.some(item => item.tripId === current) ? current : current ?? result.items[0]?.tripId ?? null));
    } catch (e) {
      setError(errorMessage(e, 'Không tải được dashboard vận hành.'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const timer = window.setInterval(() => void load(), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  function select(tripId: string) {
    setSelectedId(tripId);
    window.setTimeout(() => detail.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  }

  if (loading) return <p role="status">Đang tải…</p>;

  return (
    <div className="trk-ops">
      {error && <p className="error" role="alert">{error} <button type="button" className="trk-link" onClick={() => void load()}>Thử lại</button></p>}
      {data && (
        <>
          <div className="trk-stats">
            <div><span>Đang vận chuyển</span><strong>{data.summary.inTransit}</strong><small>chuyến</small></div>
            <div className={data.summary.openIncidents ? 'is-alert' : ''}><span>Sự cố chưa đóng</span><strong>{data.summary.openIncidents}</strong><small>sự cố</small></div>
            <div className={data.summary.overdueTrips ? 'is-alert' : ''}><span>Chuyến trễ hạn</span><strong>{data.summary.overdueTrips}</strong><small>quá giờ đến dự kiến</small></div>
          </div>

          <div className="trk-ops-grid">
            <section className="portal-panel trk-panel trk-ops-list" aria-label="Chuyến đang vận hành">
              <div className="portal-panel-heading">
                <h2>Chuyến đang vận hành</h2>
                <button type="button" className="trk-secondary" onClick={() => void load()}>Làm mới</button>
              </div>
              {data.items.length === 0 ? (
                <div className="portal-empty">
                  <span aria-hidden="true">◇</span>
                  <h3>Hiện không có chuyến đang vận hành</h3>
                  <p>Chuyến xuất hiện ở đây khi đang vận chuyển hoặc còn sự cố chưa đóng.</p>
                </div>
              ) : (
                <ul className="trk-trip-rows">
                  {data.items.map(item => (
                    <li key={item.tripId}>
                      <button type="button" className={'trk-trip-row' + (item.tripId === selectedId ? ' is-selected' : '') + (item.highUrgencyOpenIncidents ? ' is-urgent' : item.isOverdue ? ' is-late' : '')} aria-pressed={item.tripId === selectedId} onClick={() => select(item.tripId)}>
                        <span className="trk-trip-top">
                          <strong>{item.orderCode}</strong>
                          <span className="status-chip" data-status={item.orderStatus}>{ORDER_STATUS_LABEL[item.orderStatus] ?? item.orderStatus}</span>
                        </span>
                        <span className="trk-muted">Chuyến #{item.tripId} · {item.customerName}</span>
                        <span>
                          {item.currentLeg
                            ? `Chặng ${item.currentLeg.seqNo}/${item.legCount}: ${item.currentLeg.fromLocationName} → ${item.currentLeg.toLocationName} (${LEG_STATUS_LABEL[item.currentLeg.status]})`
                            : `${item.completedLegs}/${item.legCount} chặng hoàn thành`}
                        </span>
                        <span className="trk-trip-flags">
                          {item.highUrgencyOpenIncidents > 0 && <span className="status-chip" data-status="URGENT">{item.highUrgencyOpenIncidents} sự cố khẩn</span>}
                          {item.openIncidents > item.highUrgencyOpenIncidents && <span className="status-chip" data-status="NEW">{item.openIncidents - item.highUrgencyOpenIncidents} sự cố mở</span>}
                          {item.isOverdue && <span className="status-chip" data-status="LATE">Trễ hạn</span>}
                        </span>
                        <span className="trk-muted">Cập nhật {item.lastUpdatedAt ? formatDateTime(item.lastUpdatedAt) : '—'}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </section>

            <div ref={detail} className="trk-ops-detail">
              {selectedId
                ? <TripDetailPanel key={selectedId} tripId={selectedId} role={role} onChanged={() => void load()} />
                : <p className="trk-hint">Chọn một chuyến để xem tiến độ chi tiết.</p>}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
