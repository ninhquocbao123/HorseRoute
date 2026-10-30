import { useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import type { ITripPositionInput } from '@my-project/shared';
import { trackingApi } from '../tracking.api';

/** Gửi lô mỗi 30 giây (API: tối đa 20 điểm/lô, 30 request/phút/tài khoản). */
export const GPS_SEND_MS = 30_000;
/** Lấy mẫu tối đa 1 điểm/5 giây: đủ vẽ vệt đường, lô 30 giây không vượt 20 điểm. */
export const GPS_SAMPLE_MS = 5_000;
const BATCH = 20;
const MAX_QUEUE = 2_000;
/** API từ chối điểm cũ hơn 24 giờ; bỏ trước khi gửi để lô không bị 400 cả cụm. */
const MAX_AGE_MS = 23 * 60 * 60_000;
const MAX_BACKOFF_MS = 5 * 60_000;
const PREFIX = 'wdp:tracking:';

export type GpsStatus = 'off' | 'unsupported' | 'denied' | 'locating' | 'sharing' | 'offline' | 'stopped';
export type GpsFix = { lng: number; lat: number; speedKmh: number | null; headingDeg: number | null; at: string };

function read<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}
function write(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    // bộ nhớ đầy/bị chặn: hàng đợi chỉ còn trong phiên hiện tại
  }
}

/** Hàng đợi điểm chưa gửi, theo chuyến + tài khoản (máy dùng chung giữa tài xế và hộ tống). */
export const gpsQueue = {
  key: (tripId: string, userId: string) => `gps-queue:${tripId}:${userId}`,
  get: (tripId: string, userId: string) => read<ITripPositionInput[]>(gpsQueue.key(tripId, userId), []),
  set: (tripId: string, userId: string, points: ITripPositionInput[]) => write(gpsQueue.key(tripId, userId), points.slice(-MAX_QUEUE)),
};

const consentKey = (userId: string) => `gps-consent:${userId}`;
const enabledKey = (userId: string) => `gps-enabled:${userId}`;

type WakeLockSentinelLike = { release: () => Promise<void> };

/**
 * Chia sẻ GPS của tài xế (D1b). Chỉ chạy khi trang đang mở (giới hạn của web), `eligible` (đơn IN_TRANSIT, chặng hiện
 * tại không phải chặng bay) và tài xế đã bật công tắc sau khi đồng ý ở lần đầu (dữ liệu cá nhân, tự xóa sau 30 ngày).
 * Mất mạng: giữ hàng đợi trong localStorage và gửi bù (API chống trùng theo recordedAt).
 */
export function useGpsSharing({ tripId, userId, eligible }: { tripId: string; userId: string; eligible: boolean }) {
  const [consented, setConsented] = useState(() => !!read<string | null>(consentKey(userId), null));
  const [enabled, setEnabled] = useState(() => read<boolean>(enabledKey(userId), false) && !!read<string | null>(consentKey(userId), null));
  const [consentOpen, setConsentOpen] = useState(false);
  const [status, setStatus] = useState<GpsStatus>('off');
  const [stopReason, setStopReason] = useState('');
  const [lastFix, setLastFix] = useState<GpsFix | null>(null);
  const [lastSentAt, setLastSentAt] = useState<string | null>(null);
  const [queued, setQueued] = useState(() => gpsQueue.get(tripId, userId).length);
  const flushing = useRef(false);
  const backoff = useRef(GPS_SEND_MS);
  const lastSampleAt = useRef(0);
  const active = enabled && eligible;

  const enable = useCallback(() => {
    if (!consented) return setConsentOpen(true);
    setEnabled(true);
    setStopReason('');
    write(enabledKey(userId), true);
  }, [consented, userId]);

  const disable = useCallback(() => {
    setEnabled(false);
    write(enabledKey(userId), false);
  }, [userId]);

  const acceptConsent = useCallback(() => {
    write(consentKey(userId), new Date().toISOString());
    write(enabledKey(userId), true);
    setConsented(true);
    setEnabled(true);
    setStopReason('');
    setConsentOpen(false);
  }, [userId]);

  /** Gửi hàng đợi theo lô 20 điểm; trả về false khi phải dừng hẳn (409/403/404). */
  const flush = useCallback(async () => {
    if (flushing.current) return;
    flushing.current = true;
    try {
      let queue = gpsQueue.get(tripId, userId).filter(point => Date.now() - Date.parse(point.recordedAt) < MAX_AGE_MS);
      // Tối đa 3 lô mỗi lần để không vượt giới hạn 30 request/phút khi gửi bù một hàng đợi dài.
      for (let round = 0; round < 3 && queue.length; round++) {
        const batch = queue.slice(0, BATCH);
        try {
          await trackingApi.postPositions(tripId, batch);
          queue = queue.slice(batch.length);
          backoff.current = GPS_SEND_MS;
          setLastSentAt(new Date().toISOString());
          setStatus('sharing');
        } catch (error) {
          const code = isAxiosError(error) ? error.response?.status : undefined;
          if (code === undefined) {
            setStatus('offline'); // mất mạng: giữ nguyên, gửi bù khi có mạng
          } else if (code === 409 || code === 403 || code === 404) {
            queue = [];
            setStatus('stopped');
            setStopReason(code === 409
              ? 'Chuyến không còn nhận vị trí (đã giao xong hoặc đang ở chặng bay).'
              : 'Bạn không còn được phân công chuyến này.');
            setEnabled(false);
          } else if (code === 429) {
            backoff.current = Math.min(backoff.current * 2, MAX_BACKOFF_MS); // lùi lại rồi thử tiếp
          } else if (code === 400) {
            queue = queue.slice(batch.length); // lô hỏng (vd. giờ máy lệch): bỏ để không kẹt cả hàng đợi
            continue;
          }
          break;
        }
      }
      gpsQueue.set(tripId, userId, queue);
      setQueued(queue.length);
    } finally {
      flushing.current = false;
    }
  }, [tripId, userId]);

  // Theo dõi vị trí + gửi định kỳ khi đang bật và chuyến còn nhận GPS.
  useEffect(() => {
    if (!active) {
      setStatus(current => (current === 'stopped' ? current : 'off'));
      return;
    }
    if (!('geolocation' in navigator)) {
      setStatus('unsupported');
      return;
    }
    setStatus(navigator.onLine === false ? 'offline' : 'locating');
    let timer: number | undefined;
    const schedule = () => {
      timer = window.setTimeout(async () => {
        await flush();
        schedule();
      }, backoff.current);
    };
    const watchId = navigator.geolocation.watchPosition(
      position => {
        const now = Date.now();
        if (now - lastSampleAt.current < GPS_SAMPLE_MS) return;
        lastSampleAt.current = now;
        const { latitude, longitude, accuracy, speed, heading } = position.coords;
        const recordedAt = new Date(position.timestamp || now).toISOString();
        const point: ITripPositionInput = { latitude: round6(latitude), longitude: round6(longitude), recordedAt };
        if (Number.isFinite(accuracy)) point.accuracyM = Math.round(accuracy);
        if (speed !== null && Number.isFinite(speed) && speed >= 0) point.speedMps = Math.round(speed * 100) / 100;
        if (heading !== null && Number.isFinite(heading) && heading >= 0) point.headingDeg = Math.round(heading) % 360;
        const queue = [...gpsQueue.get(tripId, userId), point];
        gpsQueue.set(tripId, userId, queue);
        setQueued(queue.length);
        setLastFix({ lng: point.longitude, lat: point.latitude, speedKmh: point.speedMps === undefined ? null : Math.round(point.speedMps * 3.6), headingDeg: point.headingDeg ?? null, at: recordedAt });
        setStatus(current => (current === 'locating' ? 'sharing' : current));
      },
      error => {
        if (error.code === error.PERMISSION_DENIED) setStatus('denied');
        // Hết thời gian / chưa có tín hiệu: watchPosition tự thử lại, giữ trạng thái đang chờ.
      },
      { enableHighAccuracy: true, maximumAge: GPS_SAMPLE_MS, timeout: 30_000 },
    );
    const onOnline = () => void flush();
    const onOffline = () => setStatus('offline');
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    void flush(); // gửi bù hàng đợi còn lại từ lần trước
    schedule();
    return () => {
      navigator.geolocation.clearWatch(watchId);
      window.clearTimeout(timer);
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, [active, flush, tripId, userId]);

  // Giữ màn hình sáng khi đang chia sẻ (thiết kế mục 9): tắt màn hình thì trình duyệt ngừng gửi vị trí.
  const blocked = status === 'denied' || status === 'unsupported';
  useEffect(() => {
    if (!active || blocked) return;
    const nav = navigator as Navigator & { wakeLock?: { request: (type: 'screen') => Promise<WakeLockSentinelLike> } };
    if (!nav.wakeLock) return;
    let sentinel: WakeLockSentinelLike | null = null;
    let cancelled = false;
    const acquire = () => {
      if (document.visibilityState !== 'visible') return;
      nav.wakeLock!.request('screen')
        .then(lock => { if (cancelled) void lock.release(); else sentinel = lock; })
        .catch(() => undefined); // không được phép (pin yếu, chính sách): bỏ qua
    };
    acquire();
    document.addEventListener('visibilitychange', acquire);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', acquire);
      void sentinel?.release().catch(() => undefined);
    };
  }, [active, blocked]);

  return {
    status, enabled, active, consentOpen, stopReason, lastFix, lastSentAt, queued,
    enable, disable, acceptConsent, declineConsent: () => setConsentOpen(false),
  };
}

const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
export type GpsSharing = ReturnType<typeof useGpsSharing>;
