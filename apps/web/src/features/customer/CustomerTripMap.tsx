import { useEffect, useState } from 'react';
import type { ITripMap } from '@my-project/shared';
import MapView from '../trackmap/MapView';
import { CustomerRouteMap } from '../trackmap/lazy-maps';
import { trackingApi } from '../tracking/tracking.api';

/** Đủ để thấy mốc mới tài xế vừa ghi; vị trí không theo GPS nên không cần làm mới dày. */
const REFRESH_MS = 60_000;

/**
 * Bản đồ trong thẻ "Chuyến đang chạy" của trang chủ khách: vị trí xe cập nhật theo từng mốc tài xế check-in.
 * Dưới bản đồ: điểm đi → điểm đến và mốc mới nhất.
 */
export default function CustomerTripMap({ orderId, from, to }: { orderId: string; from: string; to: string }) {
  const [map, setMap] = useState<ITripMap | null>(null);
  useEffect(() => {
    let cancelled = false;
    const load = () => trackingApi.customerOrderMap(orderId).then(next => { if (!cancelled) setMap(next); }).catch(() => undefined);
    void load();
    const timer = window.setInterval(() => { if (document.visibilityState === 'visible') void load(); }, REFRESH_MS);
    return () => { cancelled = true; window.clearInterval(timer); };
  }, [orderId]);
  const status = map?.position?.label?.replace(/^Ước tính theo kế hoạch, không phải GPS: /, '');
  return (
    <div className="cj-map customer-trip-map">
      <MapView height={190} label={`Bản đồ hành trình ${from} đến ${to}`} hint="Bấm “Theo dõi hành trình” để xem từng chặng.">
        <CustomerRouteMap map={map} />
      </MapView>
      <span>{from} <b>→</b> {to}</span>
      {status && <span className="customer-trip-map-status">{status.charAt(0).toUpperCase() + status.slice(1)}</span>}
    </div>
  );
}
