import { useEffect, useState, type ReactNode } from 'react';
import { ClockCircleOutlined, DashboardOutlined, EnvironmentOutlined } from '@ant-design/icons';
import type { ILegTracking } from '@my-project/shared';
import { formatDayTime, formatDuration } from './driver-ui';

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

function Stat({ label, icon, value, sub, tone }: { label: string; icon: ReactNode; value: string; sub: string; tone?: 'muted' | 'warn' }) {
  return (
    <div className="drv-stat-card">
      <div className="drv-stat-head">
        <span>{label}</span>
        <span className="drv-icon-box" aria-hidden="true">{icon}</span>
      </div>
      <strong>{value}</strong>
      <small className={tone ? 'is-' + tone : undefined}>{sub}</small>
    </div>
  );
}

/**
 * Ba thẻ dưới bản đồ D1b (Figma 57:5212). Chưa có GPS nên "Tốc độ" để trống và không có km (bước H).
 * "Đã chạy" = giờ hiện tại − giờ xuất phát thực tế chặng 1; dòng phụ = giờ đến dự kiến của chặng hiện tại − giờ hiện tại.
 */
export default function LiveStatsCards({ legs, leg }: { legs: ILegTracking[]; leg: ILegTracking | null }) {
  const now = useNow();
  const departedAt = legs[0]?.actualDepartureAt ? Date.parse(legs[0].actualDepartureAt) : null;
  const arrival = leg ? new Date(leg.plannedArrivalAt) : null;
  const remaining = arrival ? arrival.getTime() - now : 0;
  return (
    <div className="drv-stats-row" aria-label="Tình hình chuyến">
      <Stat
        label="Chặng tiếp" icon={<EnvironmentOutlined />} value={leg?.toLocationName ?? '—'}
        sub={arrival ? (sameDay(arrival, new Date(now)) ? time.format(arrival) : formatDayTime(arrival)) : '—'}
      />
      <Stat label="Tốc độ" icon={<DashboardOutlined />} value="—" sub="Có ở bước bật GPS" tone="muted" />
      <Stat
        label="Đã chạy" icon={<ClockCircleOutlined />} value={departedAt ? formatDuration(now - departedAt) : '—'}
        sub={!arrival ? '—' : remaining >= 0 ? `nghỉ tiếp sau ${formatDuration(remaining)}` : `trễ ${formatDuration(-remaining)}`}
        tone={arrival && remaining < 0 ? 'warn' : undefined}
      />
    </div>
  );
}
