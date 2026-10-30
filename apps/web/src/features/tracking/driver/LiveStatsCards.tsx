import { useEffect, useState, type ReactNode } from 'react';
import { Tooltip } from 'antd';
import { ClockCircleOutlined, DashboardOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { ILegTracking, ITripMap } from '@my-project/shared';
import { formatDayTime, formatDuration, formatKm } from './driver-ui';
import { elapsedSub, isStopped, nextStopView, tripPhase } from './trip-phase';
import type { GpsFix } from './useGpsSharing';

/** Số đo GPS trên máy còn được coi là "đang có tín hiệu" trong khoảng này (máy lấy mẫu mỗi 5 giây). */
const OWN_FIX_FRESH_MS = 30_000;

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const sameDay = (a: Date, b: Date) => a.toDateString() === b.toDateString();

/** Thời điểm hiện tại, cập nhật mỗi 60 giây. */
export function useNow(intervalMs = 60_000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(timer);
  }, [intervalMs]);
  return now;
}

function Stat({ label, icon, value, sub, tone, clamp, valueTone }: {
  label: string; icon: ReactNode; value: string; sub: string; tone?: 'muted' | 'warn'; clamp?: boolean; valueTone?: 'warn';
}) {
  return (
    <div className="drv-stat-card">
      <div className="drv-stat-head">
        <span>{label}</span>
        <span className="drv-icon-box" aria-hidden="true">{icon}</span>
      </div>
      {clamp
        ? <Tooltip title={value}><strong className="is-clamped" title={value}>{value}</strong></Tooltip>
        : <strong className={valueTone ? 'is-' + valueTone : undefined}>{value}</strong>}
      <small className={tone ? 'is-' + tone : undefined}>{sub}</small>
    </div>
  );
}

/**
 * Ba thẻ dưới bản đồ D1b (Figma 57:5212).
 * - "Chặng tiếp": thêm "còn X km" khi /map tính được (km còn lại của cả chuyến trừ các chặng sau).
 * - "Tốc độ": ưu tiên số đo GPS vừa lấy trên máy tài xế (cập nhật ~5 giây, không chờ gửi/tải lại /map); không có thì dùng GPS mới
 *   nhất của server khi còn LIVE; so với VMAX; GPS cũ → "GPS cũ n phút"; chưa có GPS → "—".
 * - "Đã chạy" = giờ hiện tại − giờ xuất phát thực tế chặng 1; dòng phụ = giờ đến dự kiến của chặng hiện tại − giờ hiện tại.
 */
export default function LiveStatsCards({ legs, map, ownFix = null, nextWaypoint = null }: { legs: ILegTracking[]; map: ITripMap | null; ownFix?: GpsFix | null; nextWaypoint?: string | null }) {
  const now = useNow();
  // Đồng hồ riêng 5 giây cho tốc độ trên máy: số đo cũ quá 30 giây thì quay về dữ liệu server.
  const tick = useNow(5_000);
  const phase = tripPhase(legs);
  // Lộ trình có điểm nghỉ giữa đường: "Chặng tiếp" là điểm nghỉ chưa check-in, chưa phải điểm nhận.
  const next = nextWaypoint ? { name: nextWaypoint, km: null, arrivalAt: null, arrived: false } : nextStopView(phase, map);
  const kmToNext = next?.km ?? null;
  const local = ownFix && ownFix.speedKmh !== null && tick - Date.parse(ownFix.at) < OWN_FIX_FRESH_MS ? ownFix.speedKmh : null;
  const speed = local !== null ? liveSpeed(local, map?.speedLimitKmh ?? null) : speedView(map, now, isStopped(phase));
  const departedAt = legs[0]?.actualDepartureAt ? Date.parse(legs[0].actualDepartureAt) : null;
  const arrival = next?.arrivalAt ? new Date(next.arrivalAt) : null;
  const elapsed = elapsedSub(phase, now);
  return (
    <div className="drv-stats-row" aria-label="Tình hình chuyến">
      <Stat
        label="Chặng tiếp" icon={<EnvironmentOutlined />} value={next?.name ?? '—'} clamp
        sub={next?.arrived ? 'đã tới điểm đích' : [kmToNext !== null && kmToNext > 0 && `còn ${formatKm(kmToNext)} km`, arrival && (sameDay(arrival, new Date(now)) ? time.format(arrival) : formatDayTime(arrival))].filter(Boolean).join(' · ') || '—'}
      />
      <Stat label="Tốc độ" icon={<DashboardOutlined />} value={speed.value} sub={speed.sub} tone={speed.tone} valueTone={speed.over ? 'warn' : undefined} />
      <Stat
        label="Đã chạy" icon={<ClockCircleOutlined />} value={departedAt ? formatDuration(now - departedAt) : '—'}
        sub={elapsed.text} tone={elapsed.warn ? 'warn' : undefined}
      />
    </div>
  );
}

function liveSpeed(kmh: number, limit: number | null) {
  const over = limit !== null && kmh > limit;
  return { value: `${Math.round(kmh)} km/h`, sub: limit !== null ? `giới hạn ${limit} km/h` : 'Chưa cấu hình giới hạn', tone: over ? 'warn' as const : undefined, over };
}

function speedView(map: ITripMap | null, now: number, stopped: boolean): { value: string; sub: string; tone?: 'muted' | 'warn'; over: boolean } {
  const gps = map?.latestPosition;
  const limit = map?.speedLimitKmh ?? null;
  if (!gps) return { value: '—', sub: 'Chưa có tín hiệu GPS', tone: 'muted', over: false };
  // Xe đang dừng: API bỏ tốc độ của điểm GPS cũ hơn mốc → hiện 0, không giữ con số lúc còn chạy.
  if (stopped && (gps.speedKmh === null || gps.freshness !== 'LIVE')) return { value: '0 km/h', sub: 'đang dừng', tone: 'muted', over: false };
  if (gps.freshness !== 'LIVE') {
    const minutes = Math.max(1, Math.round((now - Date.parse(gps.recordedAt)) / 60_000));
    return { value: '—', sub: `GPS cũ ${minutes} phút`, tone: 'muted', over: false };
  }
  const over = gps.speedKmh !== null && limit !== null && gps.speedKmh > limit;
  return {
    value: gps.speedKmh === null ? '—' : `${Math.round(gps.speedKmh)} km/h`,
    sub: limit !== null ? `giới hạn ${limit} km/h` : 'Chưa cấu hình giới hạn',
    tone: over ? 'warn' : undefined,
    over,
  };
}
