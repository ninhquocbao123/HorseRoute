import { useCallback, useEffect, useState } from 'react';
import { HORSE_APPETITE_LABEL, HORSE_CONDITION_META, type ICareActivityList, type IHorseReport, type IOrderTimeline } from '@my-project/shared';
import AttachmentImage from '../AttachmentImage';
import { activityDetail, careLabel } from '../escort/care-ui';
import { errorMessage, trackingApi } from '../tracking.api';
import CustomerJourneyTimeline from './CustomerJourneyTimeline';
import { ORDER_STATUS_LABEL, formatDateTime } from '../tracking.format';
import { statuses } from '../../orders/types';

type OrderItem = Awaited<ReturnType<typeof trackingApi.customerOrders>>[number];

const REFRESH_MS = 60_000;

/** Nhật ký chăm sóc của hộ tống (cho ăn, uống nước, nghỉ chân), mới nhất trước. */
function CareLog({ care }: { care: ICareActivityList }) {
  const { summary } = care;
  return (
    <section className="portal-panel trk-panel trk-care" aria-label="Nhật ký chăm sóc ngựa">
      <div className="portal-panel-heading"><h2>Nhật ký chăm sóc ngựa</h2></div>
      {care.activities.length === 0 ? (
        <p className="trk-muted">Hộ tống chưa ghi hoạt động chăm sóc nào cho chuyến này.</p>
      ) : (
        <>
          <p className="trk-care-summary">
            {summary.meals} bữa ăn · {summary.waterLiters.toLocaleString('vi-VN')} L nước · {summary.rests} lần nghỉ chân{summary.restMinutes ? ` (${summary.restMinutes} phút)` : ''}
          </p>
          <ul className="trk-care-list">
            {care.activities.map(activity => (
              <li key={activity.id}>
                <time dateTime={activity.performedAt}>{formatDateTime(activity.performedAt)}</time>
                <span className={'trk-care-type is-' + activity.activityType.toLowerCase()}>{careLabel(activity.activityType)}</span>
                <span className="trk-care-main">
                  <strong>{activity.horseName ?? 'Cả đoàn'}</strong>
                  <small>{activityDetail(activity) || '—'} · {activity.createdByName}</small>
                  {activity.photos.length > 0 && (
                    <span className="trk-report-photos trk-care-photos">{activity.photos.map(photo => <AttachmentImage key={photo.id} id={photo.id} name={photo.originalName} />)}</span>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

/** Báo cáo sức khỏe hộ tống chọn gửi cho khách (tình trạng, chỉ số, ảnh). */
function HorseReports({ reports }: { reports: IHorseReport[] }) {
  if (!reports.length) return null;
  return (
    <section className="portal-panel trk-panel" aria-label="Báo cáo sức khỏe ngựa">
      <div className="portal-panel-heading"><h2>Báo cáo sức khỏe ngựa</h2></div>
      <ul className="trk-reports">
        {reports.map(report => {
          const meta = HORSE_CONDITION_META[report.conditionStatus];
          const vitals = [report.bodyTempC !== null && `${report.bodyTempC.toLocaleString('vi-VN')} °C`, report.heartRateBpm !== null && `${report.heartRateBpm} nhịp/phút`,
            report.appetite && `Ăn uống: ${HORSE_APPETITE_LABEL[report.appetite]}`].filter(Boolean).join(' · ');
          return (
            <li key={report.id} className={meta?.attention ? 'is-attention' : undefined}>
              <div className="trk-leg-head">
                <strong>{report.horseName} · {meta?.label ?? report.conditionStatus}</strong>
                <time dateTime={report.sentAt}>{formatDateTime(report.sentAt)}</time>
              </div>
              {vitals && <p className="trk-muted">{vitals}</p>}
              {report.customerNote && <p>{report.customerNote}</p>}
              {report.photos.length > 0 && (
                <div className="trk-report-photos">{report.photos.map(photo => <AttachmentImage key={photo.id} id={photo.id} name={photo.caption ?? report.horseName} />)}</div>
              )}
              <p className="trk-updated">Hộ tống {report.escortName}</p>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

export default function CustomerTracking() {
  const [orders, setOrders] = useState<OrderItem[]>([]);
  const [selected, setSelected] = useState<string | null>(null);
  const [timeline, setTimeline] = useState<IOrderTimeline | null>(null);
  const [care, setCare] = useState<ICareActivityList | null>(null);
  const [reports, setReports] = useState<IHorseReport[]>([]);
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
      const [nextTimeline, nextCare, nextReports] = await Promise.all([
        trackingApi.orderTimeline(orderId),
        // Nhật ký/báo cáo là phần phụ: lỗi thì vẫn hiện tiến độ chặng.
        trackingApi.customerCareActivities(orderId).catch(() => null),
        trackingApi.customerHorseReports(orderId).catch(() => [] as IHorseReport[]),
      ]);
      setTimeline(nextTimeline);
      setCare(nextCare);
      setReports(nextReports);
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Không tải được tiến độ đơn hàng.'));
    } finally {
      setLoadingTimeline(false);
    }
  }, []);

  useEffect(() => {
    setCare(null);
    setReports([]);
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
          {timeline && timeline.legs.length > 0 && <CustomerJourneyTimeline timeline={timeline} />}
          {timeline && timeline.legs.length === 0 && (
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
              <p className="trk-hint">
                Lịch trình chi tiết sẽ hiển thị sau khi kế hoạch vận chuyển được duyệt và đơn hàng sẵn sàng. Chúng tôi sẽ thông báo cho bạn khi có cập nhật.
              </p>
            </section>
          )}
          {timeline && timeline.legs.length > 0 && care && <CareLog care={care} />}
          {timeline && <HorseReports reports={reports} />}
        </>
      )}
    </div>
  );
}
