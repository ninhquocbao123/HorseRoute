import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Progress, Spin, Tabs, Tag, Tooltip } from 'antd';
import { AlertOutlined, ReloadOutlined } from '@ant-design/icons';
import type { IAlert, IDriverTripSummary } from '@my-project/shared';
import { errorMessage, trackingApi, type TripDetail } from '../tracking.api';
import { ALERT_LABEL, formatDateTime } from '../tracking.format';
import TripList from './TripList';
import TripOverview from './TripOverview';
import MilestonePanel from './MilestonePanel';
import HorseLogForm from './HorseLogForm';
import IncidentDialog from './IncidentDialog';
import { ALERT_COLOR, ORDER_TAG, routeStops, tripProgress } from './driver-ui';
import './driver.css';

const SELECTED_KEY = 'wdp:tracking:selected-trip';
const TABS = [
  { key: 'assignments', label: 'Tổng quan chuyến' },
  { key: 'milestones', label: 'Mốc hành trình' },
  { key: 'horse-logs', label: 'Nhật ký ngựa' },
];

function storedTrip() {
  try {
    return sessionStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

/** Không gian làm việc của Driver/Escort trên web: danh sách chuyến bên trái, chi tiết chuyến đang chọn bên phải. */
export default function DriverWorkspace({ view, onNavigate }: { view: string; onNavigate: (view: string) => void }) {
  const [trips, setTrips] = useState<IDriverTripSummary[]>([]);
  const [details, setDetails] = useState<Record<string, TripDetail>>({});
  const [selectedId, setSelectedId] = useState<string | null>(storedTrip);
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const list = await trackingApi.driverTrips();
      setTrips(list);
      setError('');
      const entries = await Promise.all(list.map(async trip => [trip.id, await trackingApi.tripDetail(trip.id)] as const));
      setDetails(Object.fromEntries(entries));
    } catch (e) {
      setError(errorMessage(e, 'Không tải được danh sách chuyến.'));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Chuyến đang chọn; mặc định chuyến đang chạy, rồi chuyến đầu tiên.
  const selected = trips.find(t => t.id === selectedId) ?? trips.find(t => t.orderStatus === 'IN_TRANSIT') ?? trips[0] ?? null;

  function select(tripId: string) {
    setSelectedId(tripId);
    setNotice('');
    try {
      sessionStorage.setItem(SELECTED_KEY, tripId);
    } catch {
      // bỏ qua
    }
  }

  useEffect(() => {
    if (!selected) return setAlerts([]);
    trackingApi.alerts(selected.id).then(setAlerts).catch(() => setAlerts([]));
  }, [selected?.id, selected?.orderStatus]);

  const count = (status: string) => trips.filter(t => t.orderStatus === status).length;
  const stats = [
    { label: 'Chuyến được giao', value: trips.length, tone: 'brand' },
    { label: 'Đang vận chuyển', value: count('IN_TRANSIT'), tone: 'gold' },
    { label: 'Sẵn sàng khởi hành', value: count('READY'), tone: 'blue' },
    { label: 'Đã giao xong', value: count('DELIVERED'), tone: 'green' },
  ];

  if (loading) return <div className="drv-loading"><Spin size="large" /><span>Đang tải chuyến…</span></div>;

  const canReport = selected?.orderStatus === 'IN_TRANSIT';
  const detail = selected ? details[selected.id] : undefined;
  const progress = selected ? tripProgress(selected.legs) : null;
  const tab = TABS.some(t => t.key === view) ? view : 'assignments';
  const vehicles = selected ? [...new Set(selected.legs.map(leg => leg.vehicleCode).filter(Boolean))].join(', ') : '';

  return (
    <div className="drv">
      <div className="drv-stats">
        {stats.map(stat => (
          <div key={stat.label} className={'drv-stat is-' + stat.tone}>
            <span>{stat.label}</span>
            <strong>{stat.value}</strong>
          </div>
        ))}
      </div>

      {error && (
        <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />
      )}

      {!error && trips.length === 0 ? (
        <section className="drv-card drv-empty">
          <Empty description={<>
            <strong>Chưa có chuyến nào được giao</strong>
            <p>Chuyến sẽ xuất hiện khi kế hoạch được duyệt và điều phối viên phân công đủ tài xế, hộ tống (đơn tự chuyển sang sẵn sàng).</p>
          </>} />
          <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={refreshing}>Tải lại</Button>
        </section>
      ) : selected && (
        <div className="drv-layout">
          <TripList trips={trips} details={details} selectedId={selected.id} onSelect={select} />

          <div className="drv-main">
            <section className="drv-card drv-head" aria-label="Chuyến đang chọn">
              <div className="drv-head-top">
                <div className="drv-head-title">
                  <span className="drv-overline">Chuyến #{selected.id} · Vai trò: {selected.crewRole === 'DRIVER' ? 'Tài xế' : 'Hộ tống'}</span>
                  <h2>{selected.orderCode}</h2>
                  <p className="drv-route">{routeStops(selected.legs).join(' → ') || 'Chưa có chặng'}</p>
                </div>
                <div className="drv-head-actions">
                  <Tag color={ORDER_TAG[selected.orderStatus]?.color} className="drv-status-tag">{ORDER_TAG[selected.orderStatus]?.label ?? selected.orderStatus}</Tag>
                  <Button icon={<ReloadOutlined />} onClick={() => void load()} loading={refreshing}>Làm mới</Button>
                  <Tooltip title={canReport ? '' : 'Chỉ báo sự cố khi chuyến đang vận chuyển.'}>
                    <Button type="primary" danger size="large" icon={<AlertOutlined />} disabled={!canReport} onClick={() => setIncidentOpen(true)}>
                      Báo sự cố khẩn cấp
                    </Button>
                  </Tooltip>
                </div>
              </div>
              <dl className="drv-facts">
                <div><dt>Phương tiện</dt><dd>{vehicles || '—'}</dd></div>
                <div><dt>Số ngựa</dt><dd>{detail ? detail.horses.length : '…'}</dd></div>
                <div><dt>Khởi hành dự kiến</dt><dd>{formatDateTime(selected.plannedDepartureAt)}</dd></div>
                <div><dt>Đến dự kiến</dt><dd>{formatDateTime(selected.plannedArrivalAt)}</dd></div>
                <div><dt>Tiến độ</dt><dd>{progress!.done}/{progress!.total} chặng hoàn thành</dd></div>
              </dl>
              <Progress percent={progress!.percent} strokeColor="var(--color-success, #275338)" aria-label="Tiến độ chuyến" />
            </section>

            {notice && <Alert type="success" showIcon message={notice} closable onClose={() => setNotice('')} role="status" />}

            {alerts.length > 0 && (
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
            )}

            <section className="drv-card drv-tabs">
              <Tabs
                activeKey={tab}
                onChange={onNavigate}
                items={TABS.map(item => ({
                  ...item,
                  children: item.key !== tab ? null
                    : item.key === 'assignments' ? <TripOverview trip={selected} detail={detail} onOpen={onNavigate} />
                    : item.key === 'milestones' ? <MilestonePanel key={selected.id} trip={selected} onChanged={load} />
                    : <HorseLogForm key={selected.id} trip={selected} detail={detail} />,
                }))}
              />
            </section>
          </div>
        </div>
      )}

      {incidentOpen && selected && (
        <IncidentDialog
          trip={selected}
          detail={detail}
          onClose={() => setIncidentOpen(false)}
          onReported={message => {
            setIncidentOpen(false);
            setNotice(message);
          }}
        />
      )}
    </div>
  );
}
