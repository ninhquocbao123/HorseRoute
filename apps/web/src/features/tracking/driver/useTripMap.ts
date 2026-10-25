import { useCallback, useEffect, useRef, useState } from 'react';
import type { ITripMap, ITripTrackPoint } from '@my-project/shared';
import { trackingApi } from '../tracking.api';

/** /map có giới hạn 60 request/phút/tài khoản: làm mới mỗi 60 giây là đủ, vị trí của chính tài xế cập nhật ngay trên máy. */
export const MAP_REFRESH_MS = 60_000;
const MAX_TRACK = 500;

/**
 * Dữ liệu bản đồ của một chuyến: GET /map, và (khi `withTrack`) vệt đường GET /positions?since= nối dần.
 * Chỉ làm mới khi tab đang hiển thị; quay lại tab sau hơn 60 giây thì tải ngay. `refreshKey` đổi (vd. vừa ghi mốc) → tải lại.
 */
export function useTripMap(tripId: string, withTrack: boolean, refreshKey?: unknown) {
  const [map, setMap] = useState<ITripMap | null>(null);
  const [track, setTrack] = useState<ITripTrackPoint[]>([]);
  const [failed, setFailed] = useState(false);
  const lastLoad = useRef(0);
  const lastPoint = useRef<string | undefined>(undefined);

  const load = useCallback(async () => {
    lastLoad.current = Date.now();
    try {
      const next = await trackingApi.tripMap(tripId);
      setMap(next);
      setFailed(false);
    } catch {
      setFailed(true); // giữ dữ liệu cũ; khung bản đồ vẫn hiện tuyến lần tải trước
    }
    if (!withTrack) return;
    try {
      const points = await trackingApi.trackPoints(tripId, lastPoint.current);
      if (points.length) {
        lastPoint.current = points[points.length - 1].recordedAt;
        setTrack(previous => [...previous, ...points].slice(-MAX_TRACK));
      }
    } catch {
      // vệt đường là phần phụ: lỗi thì vẫn hiện tuyến và vị trí
    }
  }, [tripId, withTrack]);

  // Đổi chuyến: bỏ vệt đường cũ.
  useEffect(() => {
    setMap(null);
    setTrack([]);
    lastPoint.current = undefined;
  }, [tripId]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void load();
    }, MAP_REFRESH_MS);
    const onVisible = () => {
      if (document.visibilityState === 'visible' && Date.now() - lastLoad.current >= MAP_REFRESH_MS) void load();
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [load]);

  return { map, track, failed, reload: load };
}
