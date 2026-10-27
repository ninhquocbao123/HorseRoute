import { useEffect, useMemo, useState } from 'react';
import { DatePicker, Pagination } from 'antd';
import dayjs from 'dayjs';
import type { ICareActivity } from '@my-project/shared';
import CareActivityRow from './CareActivityRow';
import { historyDays, localDay } from './care-ui';

const PAGE = 10;

/**
 * Lịch sử hoạt động trong chuyến, nhóm theo NGÀY địa phương: chọn ngày ở trên (chỉ trong khoảng của chuyến), mỗi dòng chỉ có giờ HH:mm,
 * mới nhất trước, 10 dòng/trang. Bản đã bị đính chính được API ẩn. Không `onEdit` = chỉ xem (chuyến đã giao).
 */
export default function CareHistoryList({ activities, tripStart, tripEnd, running, onEdit }: {
  activities: ICareActivity[];
  /** Giờ xuất phát / đến của chuyến (ISO) để giới hạn ngày chọn được */
  tripStart: string | null;
  tripEnd: string | null;
  /** Chuyến còn chạy: ngày cuối là hôm nay */
  running: boolean;
  onEdit?: (activity: ICareActivity) => void;
}) {
  const range = useMemo(() => historyDays(activities, tripStart, tripEnd, running), [activities, tripStart, tripEnd, running]);
  const [day, setDay] = useState(range.initial);
  const [page, setPage] = useState(1);
  // Dữ liệu tải lại làm khoảng ngày đổi: giữ ngày đang xem nếu còn hợp lệ, không thì về ngày mặc định.
  useEffect(() => {
    setDay(current => (current >= range.min && current <= range.max ? current : range.initial));
  }, [range.min, range.max, range.initial]);
  const rows = useMemo(
    () => activities.filter(activity => localDay(activity.performedAt) === day).sort((a, b) => Date.parse(b.performedAt) - Date.parse(a.performedAt) || Number(b.id) - Number(a.id)),
    [activities, day],
  );
  const visible = rows.slice((page - 1) * PAGE, page * PAGE);

  return (
    <section className="drv-card esc-history" aria-labelledby="esc-history-title">
      <div className="drv-card-head">
        <h3 id="esc-history-title" className="drv-card-title">Lịch sử hoạt động trong chuyến</h3>
        <DatePicker
          className="esc-day" aria-label="Chọn ngày" format="DD/MM/YYYY" allowClear={false} inputReadOnly
          value={dayjs(day)} disabledDate={date => date.isBefore(dayjs(range.min), 'day') || date.isAfter(dayjs(range.max), 'day')}
          onChange={date => { if (date) { setDay(date.format('YYYY-MM-DD')); setPage(1); } }}
        />
      </div>
      <p className="esc-history-count">{rows.length} hoạt động trong ngày</p>
      {rows.length ? (
        <ul className="esc-rows">
          {visible.map(activity => <CareActivityRow key={activity.id} activity={activity} withHorse onEdit={onEdit} />)}
        </ul>
      ) : <p className="esc-none">Không có hoạt động nào trong ngày này.</p>}
      <Pagination className="esc-pager" size="small" current={page} pageSize={PAGE} total={rows.length} showSizeChanger={false} hideOnSinglePage onChange={setPage} />
    </section>
  );
}
