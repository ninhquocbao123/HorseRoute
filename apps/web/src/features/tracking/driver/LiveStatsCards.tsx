import { useEffect, useState, type ReactNode } from 'react';
import { Tooltip } from 'antd';
import { ClockCircleOutlined, DashboardOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { ILegTracking, ITripMap } from '@my-project/shared';
import { formatDayTime, formatDuration, formatKm } from './driver-ui';
import { elapsedSub, nextStopView, tripPhase } from './trip-phase';

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
 * - "Tốc độ": GPS mới nhất khi còn LIVE, so với VMAX; GPS cũ → "GPS cũ n phút"; chưa có GPS → "—".
 * - "Đã chạy" = giờ hiện tại − giờ xuất phát thực tế chặng 1; dòng phụ = giờ đến dự kiến của chặng hiện tại − giờ hiện tại.
 */
export default function LiveStatsCards({ legs, map }: { legs: ILegTracking[]; map: ITripMap | null }) {
  const now = useNow();
  const phase = tripPhase(legs);
  const next = nextStopView(phase, map);
  const kmToNext = next?.km ?? null;
  const speed = speedView(map, now);
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

function speedView(map: ITripMap | null, now: number): { value: string; sub: string; tone?: 'muted' | 'warn'; over: boolean } {
  const gps = map?.latestPosition;
  const limit = map?.speedLimitKmh ?? null;
  if (!gps) return { value: '—', sub: 'Chưa có tín hiệu GPS', tone: 'muted', over: false };
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
