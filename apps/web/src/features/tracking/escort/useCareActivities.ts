import { useCallback, useEffect, useRef, useState } from 'react';
import type { ICareActivity, ICareSummary, IHorseLog } from '@my-project/shared';
import { errorMessage, trackingApi } from '../tracking.api';
import { todayRange } from './care-ui';

const REFRESH_MS = 120_000;
const EMPTY_SUMMARY: ICareSummary = { waterLiters: 0, meals: 0, rests: 0, restMinutes: 0, lastFeedAtByHorse: {} };

/**
 * Dữ liệu E1 của một chuyến: hoạt động cả chuyến (mới nhất trước, bản đã đính chính bị ẩn), tổng "Hôm nay"
 * (khoảng ngày địa phương), "lần cho ăn gần nhất" (toàn chuyến) và báo cáo sức khỏe (trạng thái từng ngựa).
 * Tải lại khi gọi `reload`, mỗi 2 phút khi tab hiển thị.
 */
export function useCareActivities(tripId: string) {
  const [activities, setActivities] = useState<ICareActivity[]>([]);
  const [today, setToday] = useState<ICareSummary>(EMPTY_SUMMARY);
  const [lastFeed, setLastFeed] = useState<Record<string, string>>({});
  const [logs, setLogs] = useState<IHorseLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const range = useRef(todayRange());

  const reload = useCallback(async () => {
    range.current = todayRange();
    try {
      const [all, day, reports] = await Promise.all([
        trackingApi.careActivities(tripId),
        trackingApi.careActivities(tripId, range.current),
        // Báo cáo sức khỏe chỉ để hiện trạng thái: lỗi ở đây không chặn E1.
        trackingApi.horseLogs(tripId).catch(() => [] as IHorseLog[]),
      ]);
      setActivities(all.activities);
      setLastFeed(all.summary.lastFeedAtByHorse);
      setToday(day.summary);
      setLogs(reports);
      setError('');
    } catch (e) {
      setError(errorMessage(e, 'Không tải được nhật ký chăm sóc.'));
    } finally {
      setLoading(false);
    }
  }, [tripId]);

  useEffect(() => {
    setLoading(true);
    void reload();
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') void reload();
    }, REFRESH_MS);
    return () => window.clearInterval(timer);
  }, [reload]);

  return { activities, today, lastFeed, logs, loading, error, reload, range: range.current };
}
