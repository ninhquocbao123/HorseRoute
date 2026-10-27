import { useCallback, useEffect, useState } from 'react';
import type { CrewRole, IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';

const ACTIVE = new Set(['READY', 'IN_TRANSIT']);
const departure = (trip: IDriverTripSummary) => Date.parse(trip.plannedDepartureAt ?? '') || Number.MAX_SAFE_INTEGER;

/**
 * Chuyến đang hoạt động: IN_TRANSIT, không có thì READY khởi hành sớm nhất. Các chuyến READY/IN_TRANSIT còn lại (dữ liệu sai quy tắc
 * "một tài xế một chuyến hoạt động", cần chặn ở Flow 3 khi phân công) trả về trong `upcoming`; `history` là chuyến đã giao, mới nhất trước.
 */
export function splitTrips(trips: IDriverTripSummary[]) {
  const live = trips.filter(trip => ACTIVE.has(trip.orderStatus));
  const sorted = [...live].sort((a, b) => Number(b.orderStatus === 'IN_TRANSIT') - Number(a.orderStatus === 'IN_TRANSIT') || departure(a) - departure(b));
  const doneAt = (trip: IDriverTripSummary) => Date.parse(trip.legs[trip.legs.length - 1]?.actualArrivalAt ?? trip.plannedArrivalAt ?? '') || 0;
  return {
    active: sorted[0] ?? null,
    upcoming: sorted.slice(1),
    history: trips.filter(trip => trip.orderStatus === 'DELIVERED' || trip.orderStatus === 'CANCELLED').sort((a, b) => doneAt(b) - doneAt(a)),
  };
}

/** Chuyến được giao cho tài xế: danh sách, chi tiết từng chuyến, chuyến đang hoạt động và lịch sử. */
export function useDriverTrips() {
  const [trips, setTrips] = useState<IDriverTripSummary[]>([]);
  const [details, setDetails] = useState<Record<string, IDriverTripDetail>>({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

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

  const { active, upcoming, history } = splitTrips(trips);
  /** Lịch sử theo vai trò: khung tài xế chỉ các chuyến làm DRIVER, khung hộ tống chỉ ESCORT (`history` là tất cả, dùng để xác định khung). */
  const historyFor = (role: CrewRole) => history.filter(trip => trip.crewRole === role);
  return { trips, details, selected: active, active, upcoming, history, historyFor, load, loading, refreshing, error };
}

export type DriverTrips = ReturnType<typeof useDriverTrips>;
