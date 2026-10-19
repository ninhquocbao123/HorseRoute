import { useCallback, useEffect, useState } from 'react';
import type { IAlert, IDriverTripSummary } from '@my-project/shared';
import { errorMessage, trackingApi, type TripDetail } from '../tracking.api';
import { formatDateTime } from '../tracking.format';
import TripList from './TripList';
import MilestonePanel from './MilestonePanel';
import HorseLogForm from './HorseLogForm';
import IncidentDialog from './IncidentDialog';

const SELECTED_KEY = 'wdp:tracking:selected-trip';
const ALERT_LABEL: Record<string, string> = { TRAFFIC: 'Giao thông', WEATHER: 'Thời tiết', BORDER: 'Cửa khẩu' };

function storedTrip() {
  try {
    return sessionStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

export default function DriverWorkspace({ view, onNavigate }: { view: string; onNavigate: (view: string) => void }) {
  const [trips, setTrips] = useState<IDriverTripSummary[]>([]);
  const [details, setDetails] = useState<Record<string, TripDetail>>({});
  const [selectedId, setSelectedId] = useState<string | null>(storedTrip);
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [incidentOpen, setIncidentOpen] = useState(false);
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
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
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  // Chuyến đang chọn; mặc định chuyến đang chạy, rồi chuyến đầu tiên.
  const selected = trips.find(t => t.id === selectedId) ?? trips.find(t => t.orderStatus === 'IN_TRANSIT') ?? trips[0] ?? null;

  function select(tripId: string) {
    setSelectedId(tripId);
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

  const canReport = selected?.orderStatus === 'IN_TRANSIT';

  return (
    <div className="trk-driver">
      <div className="trk-emergency">
        <button type="button" className="trk-danger trk-wide" disabled={!canReport} onClick={() => setIncidentOpen(true)}>
          ⚠ BÁO SỰ CỐ KHẨN CẤP
        </button>
        {!canReport && <small>Chỉ báo sự cố khi chuyến đang vận chuyển.</small>}
      </div>

      {notice && <p className="trk-notice" role="status">{notice}</p>}
      {loading && <p role="status">Đang tải chuyến…</p>}
      {error && <p className="error" role="alert">{error} <button type="button" className="trk-link" onClick={() => void load()}>Thử lại</button></p>}

      {selected && trips.length > 1 && (
        <label className="trk-field trk-trip-picker">
          Chuyến đang thao tác
          <select value={selected.id} onChange={event => select(event.target.value)}>
            {trips.map(trip => <option key={trip.id} value={trip.id}>{trip.orderCode} · Chuyến #{trip.id}</option>)}
          </select>
        </label>
      )}

      {alerts.length > 0 && selected && (
        <section className="trk-alerts" aria-label="Cảnh báo của điều phối viên">
          <h3>Cảnh báo từ điều phối viên</h3>
          <ul>
            {[...alerts].reverse().slice(0, 3).map(alert => (
              <li key={alert.id}>
                <span className="status-chip" data-status="ALERT">{ALERT_LABEL[alert.alertType] ?? alert.alertType}</span>
                <span>{alert.content}</span>
                <time dateTime={alert.sentAt}>{formatDateTime(alert.sentAt)}</time>
              </li>
            ))}
          </ul>
        </section>
      )}

      {!loading && !error && view === 'assignments' && (
        <TripList trips={trips} details={details} selectedId={selected?.id ?? null} onSelect={select} onOpen={onNavigate} />
      )}
      {!loading && view === 'milestones' && (selected
        ? <MilestonePanel key={selected.id} trip={selected} onChanged={load} />
        : !error && <p className="trk-hint">Bạn chưa được giao chuyến nào.</p>)}
      {!loading && view === 'horse-logs' && (selected
        ? <HorseLogForm key={selected.id} trip={selected} detail={details[selected.id]} />
        : !error && <p className="trk-hint">Bạn chưa được giao chuyến nào.</p>)}

      {incidentOpen && selected && (
        <IncidentDialog
          trip={selected}
          detail={details[selected.id]}
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
