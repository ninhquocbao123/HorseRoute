import { useCallback, useEffect, useState } from 'react';
import type { IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';

const SELECTED_KEY = 'wdp:tracking:selected-trip';

function storedTrip() {
  try {
    return sessionStorage.getItem(SELECTED_KEY);
  } catch {
    return null;
  }
}

/** Chuyến được giao cho tài xế: danh sách, chi tiết từng chuyến và chuyến đang chọn. */
export function useDriverTrips() {
  const [trips, setTrips] = useState<IDriverTripSummary[]>([]);
  const [details, setDetails] = useState<Record<string, IDriverTripDetail>>({});
  const [selectedId, setSelectedId] = useState<string | null>(storedTrip);
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

  // Mặc định chuyến đang chạy, không có thì chuyến sẵn sàng, cuối cùng là chuyến đầu tiên.
  const selected = trips.find(t => t.id === selectedId)
    ?? trips.find(t => t.orderStatus === 'IN_TRANSIT')
    ?? trips.find(t => t.orderStatus === 'READY')
    ?? trips[0]
    ?? null;

  const select = useCallback((tripId: string) => {
    setSelectedId(tripId);
    try {
      sessionStorage.setItem(SELECTED_KEY, tripId);
    } catch {
      // bỏ qua
    }
  }, []);

  return { trips, details, selected, select, load, loading, refreshing, error };
}

export type DriverTrips = ReturnType<typeof useDriverTrips>;
