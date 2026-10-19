import { useCallback, useEffect, useState } from 'react';
import type { IOrderTimeline, ITimelineLeg } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';
import { LEG_STATUS_LABEL, MILESTONE_LABEL, ORDER_STATUS_LABEL, formatDateTime } from '../tracking.format';
import { statuses } from '../../orders/types';

type OrderItem = Awaited<ReturnType<typeof trackingApi.customerOrders>>[number];

const REFRESH_MS = 60_000;

function LegStep({ leg }: { leg: ITimelineLeg }) {
  const done = leg.status === 'COMPLETED';
  const active = leg.status === 'MOVING' || leg.status === 'AT_STOP';
  return (
    <li className={'trk-step' + (done ? ' is-done' : active ? ' is-active' : '')} data-status={leg.status}>
      <span className="trk-step-dot" aria-hidden="true">{done ? '✓' : leg.seqNo}</span>
      <div className="trk-step-body">
        <div className="trk-leg-head">
          <strong>{leg.fromLocationName} → {leg.toLocationName}</strong>
          <span className="status-chip" data-status={leg.status}>{LEG_STATUS_LABEL[leg.status]}</span>
        </div>
        <p className="trk-muted">
          Dự kiến {formatDateTime(leg.plannedDepartureAt)} – {formatDateTime(leg.plannedArrivalAt)}
          {leg.isOverdue && <span className="trk-late"> · Chậm so với dự kiến</span>}
        </p>
        {leg.milestones.length > 0 ? (
          <ul className="trk-milestones">
            {leg.milestones.map(m => (
              <li key={m.milestoneType}>
                <span>{MILESTONE_LABEL[m.milestoneType]}</span>
                <time dateTime={m.occurredAt}>{formatDateTime(m.occurredAt)}</time>
              </li>
            ))}
          </ul>
        ) : (
          <p className="trk-muted">Chưa có mốc thực tế.</p>
        )}
        {leg.lastUpdatedAt && (
          <p className="trk-updated">Cập nhật lần cuối lúc {formatDateTime(leg.lastUpdatedAt)}{leg.lastUpdatedByName ? ` bởi ${leg.lastUpdatedByName}` : ''}</p>
        )}
      </div>
    </li>
  );
}

export default function CustomerTracking() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<IOrderTimeline | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingTimeline, setLoadingTimeline] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    trackingApi
      .customerOrders()
      .then(items => {
        setOrders(items);
        // Ưu tiên đơn đang vận chuyển.
        setSelected(items.find(o => o.status === 'IN_TRANSIT')?.id ?? items[0]?.id ?? null);
      })
      .catch(e => setError(errorMessage(e, 'Không tải được danh sách đơn.')))
      .finally(() => setLoading(false));
  }, []);

  const loadTimeline = useCallback(async (orderId: string, silent = false) => {
    if (!silent) setLoadingTimeline(true);
    try {
      setTimeline(await trackingApi.orderTimeline(orderId));
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Không tải được tiến độ đơn hàng.'));
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  useEffect(() => {
    if (!selected) return setTimeline(null);
    void loadTimeline(selected);
  }, [selected, loadTimeline]);

  // Tự làm mới khi đơn đang vận chuyển để khách thấy mốc mới mà không phải tải lại trang.
  useEffect(() => {
    if (!selected || timeline?.orderStatus !== 'IN_TRANSIT') return;
    const timer = window.setInterval(() => void loadTimeline(selected, true), REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [selected, timeline?.orderStatus, loadTimeline]);

  if (loading) return <p role="status">Đang tải…</p>;

  return (
    <div className="trk-customer">
      {error && <p className="error" role="alert">{error}</p>}
      {orders.length === 0 ? (
        <div className="portal-empty">
          <span aria-hidden="true">◇</span>
          <h3>Chưa có đơn nào để theo dõi</h3>
          <p>Đơn hàng sẽ xuất hiện ở đây sau khi được duyệt. Hành trình chi tiết hiển thị khi kế hoạch vận chuyển được xác nhận.</p>
        </div>
      ) : (
        <>
          <label className="trk-field trk-order-picker">
            Đơn hàng
            <select value={selected ?? ''} onChange={event => setSelected(event.target.value)}>
              {orders.map(order => (
                <option key={order.id} value={order.id}>
                  {order.order_code} · {statuses[order.status] ?? order.status}
                </option>
              ))}
            </select>
          </label>

          {loadingTimeline && !timeline && <p role="status">Đang tải tiến độ…</p>}
          {timeline && (
            <section className="portal-panel trk-panel" aria-label="Tiến độ đơn hàng">
              <div className="portal-panel-heading">
                <div>
                  <h2>{timeline.orderCode}</h2>
                  <p className="trk-muted">
                    {timeline.plannedDepartureAt ? `Khởi hành dự kiến ${formatDateTime(timeline.plannedDepartureAt)}` : 'Chưa có lịch khởi hành'}
                  </p>
                </div>
                <span className="status-chip" data-status={timeline.orderStatus}>{ORDER_STATUS_LABEL[timeline.orderStatus] ?? statuses[timeline.orderStatus] ?? timeline.orderStatus}</span>
              </div>
              {timeline.lastUpdatedAt && (
                <p className="trk-updated trk-updated-top">
                  Cập nhật lần cuối lúc {formatDateTime(timeline.lastUpdatedAt)}{timeline.lastUpdatedByName ? ` bởi ${timeline.lastUpdatedByName}` : ''}
                </p>
              )}
              {timeline.legs.length === 0 ? (
                <p className="trk-hint">
                  Lịch trình chi tiết sẽ hiển thị sau khi kế hoạch vận chuyển được duyệt và đơn hàng sẵn sàng. Chúng tôi sẽ thông báo cho bạn khi có cập nhật.
                </p>
              ) : (
                <ol className="trk-steps">{timeline.legs.map(leg => <LegStep key={leg.seqNo} leg={leg} />)}</ol>
              )}
            </section>
          )}
        </>
      )}
    </div>
  );
}
