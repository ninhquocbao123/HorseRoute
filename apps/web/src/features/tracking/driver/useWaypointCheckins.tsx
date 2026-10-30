import { useMemo, useState } from 'react';
import type { IDriverTripSummary, ITripMapStop } from '@my-project/shared';
import { isAxiosError } from 'axios';
import { trackingApi, errorMessage } from '../tracking.api';
import CheckInDialog from './CheckInDialog';
import { stopNote } from './driver-ui';

export type ViaStop = { id: string; name: string; index: number; total: number; note: string };

/**
 * Điểm dừng giữa đường của chuyến theo lộ trình mới (một chặng đại diện, các điểm nghỉ nằm trong route_plan).
 * Check-in lưu ở server (leg_waypoint_checkins) nên điều phối viên và khách hàng cùng thấy; `visited` là id điểm → giờ check-in.
 * Chỉ bật khi xe đang chạy (MOVING); trả về điểm nghỉ kế tiếp chưa check-in và hộp thoại xác nhận.
 */
export function useWaypointCheckins(trip: IDriverTripSummary, mapStops: ITripMapStop[] | undefined, running: boolean, onChanged: () => Promise<void> | void) {
  const [confirming, setConfirming] = useState<{ stop: ViaStop; tapAt: Date } | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const leg = trip.legs[0];
  const stops = mapStops ?? [];
  const routePlan = trip.legs.length === 1 && stops.length > 2;
  const visited = useMemo(() => Object.fromEntries((leg?.waypointCheckins ?? []).map(c => [c.waypointId, c.occurredAt])), [leg?.waypointCheckins]);
  const via: ViaStop[] = routePlan
    ? stops.slice(1, -1).map((stop, i) => ({ id: stop.locationId, name: stop.name, index: i + 1, total: stops.length - 2, note: stopNote(stop.locationType) }))
    : [];
  const active = running && routePlan && leg.status === 'MOVING';
  const next = active ? via.find(item => !visited[item.id]) ?? null : null;

  function open(stop: ViaStop) {
    setError('');
    setConfirming({ stop, tapAt: new Date() });
  }

  async function confirm(when: Date) {
    if (!confirming) return;
    setBusy(true);
    setError('');
    try {
      await trackingApi.recordWaypointCheckin(leg.id, confirming.stop.id, when.toISOString());
      setConfirming(null);
      await onChanged();
    } catch (e) {
      if (isAxiosError(e) && e.response?.status === 409) {
        // Trạng thái đã đổi (đã check-in ở máy khác...): tải lại để nút chỉ đúng điểm kế tiếp.
        setConfirming(null);
        await onChanged();
      } else {
        setError(errorMessage(e));
      }
    } finally {
      setBusy(false);
    }
  }

  const modal = (
    <CheckInDialog
      open={!!confirming} tapAt={confirming?.tapAt ?? null} busy={busy} error={error}
      kicker={confirming ? `Điểm dừng ${confirming.stop.index}/${confirming.stop.total}` : undefined}
      heading={confirming ? `Check-in: ${confirming.stop.name}` : ''}
      routeLabel="Điểm dừng"
      route={confirming?.stop.name}
      detail={confirming ? `${confirming.stop.note}. Khách hàng sẽ thấy xe đã tới điểm này.` : undefined}
      onCancel={() => setConfirming(null)} onConfirm={when => void confirm(when)}
    />
  );

  return { visited, next, open, modal };
}
