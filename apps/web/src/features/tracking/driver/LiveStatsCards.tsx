import { useEffect, useState, type ReactNode } from 'react';
import { Tooltip } from 'antd';
import { ClockCircleOutlined, DashboardOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { ILegTracking, ITripMap } from '@my-project/shared';
import { formatDayTime, formatDuration, formatKm } from './driver-ui';

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
export default function LiveStatsCards({ legs, leg, map }: { legs: ILegTracking[]; leg: ILegTracking | null; map: ITripMap | null }) {
  const now = useNow();
  const kmToNext = leg && map ? kmLeftOnLeg(map, leg.id) : null;
  const speed = speedView(map, now);
  const departedAt = legs[0]?.actualDepartureAt ? Date.parse(legs[0].actualDepartureAt) : null;
  const arrival = leg ? new Date(leg.plannedArrivalAt) : null;
  const remaining = arrival ? arrival.getTime() - now : 0;
  return (
    <div className="drv-stats-row" aria-label="Tình hình chuyến">
      <Stat
        label="Chặng tiếp" icon={<EnvironmentOutlined />} value={leg?.toLocationName ?? '—'} clamp
        sub={[kmToNext !== null && `còn ${formatKm(kmToNext)} km`, arrival && (sameDay(arrival, new Date(now)) ? time.format(arrival) : formatDayTime(arrival))].filter(Boolean).join(' · ') || '—'}
      />
      <Stat label="Tốc độ" icon={<DashboardOutlined />} value={speed.value} sub={speed.sub} tone={speed.tone} valueTone={speed.over ? 'warn' : undefined} />
      <Stat
        label="Đã chạy" icon={<ClockCircleOutlined />} value={departedAt ? formatDuration(now - departedAt) : '—'}
        sub={!arrival ? '—' : remaining >= 0 ? `nghỉ tiếp sau ${formatDuration(remaining)}` : `trễ ${formatDuration(-remaining)}`}
        tone={arrival && remaining < 0 ? 'warn' : undefined}
      />
    </div>
  );
}

/** Km còn lại của chặng `legId` = km còn lại cả chuyến − tổng km các chặng sau; null khi thiếu số liệu. */
export function kmLeftOnLeg(map: ITripMap, legId: string): number | null {
  if (map.remainingKm === null) return null;
  const index = map.legs.findIndex(item => item.id === legId);
  if (index < 0) return null;
  let later = 0;
  for (const item of map.legs.slice(index + 1)) {
    if (item.distanceKm === null) return null;
    later += item.distanceKm;
  }
  return Math.max(0, Math.round((map.remainingKm - later) * 10) / 10);
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
