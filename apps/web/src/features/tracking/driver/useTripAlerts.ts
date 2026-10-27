import { useEffect, useState } from 'react';
import type { IAlert } from '@my-project/shared';
import { trackingApi } from '../tracking.api';

/**
 * Cảnh báo của điều phối viên cho một chuyến. Hiện chưa gắn vào trang (UI-1 bỏ khung cảnh báo khỏi màn chuyến);
 * giữ lại để chuyển thành thông báo nổi ở bước sau.
 */
export function useTripAlerts(tripId: string, refreshKey?: unknown) {
  const [alerts, setAlerts] = useState<IAlert[]>([]);
  useEffect(() => {
    trackingApi.alerts(tripId).then(setAlerts).catch(() => setAlerts([]));
  }, [tripId, refreshKey]);
  return alerts;
}
