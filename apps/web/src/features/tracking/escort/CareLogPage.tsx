import { useEffect, useMemo, useState } from 'react';
import { Alert, Button, Spin } from 'antd';
import type { ICareActivity, IDriverTripDetail, IDriverTripSummary } from '@my-project/shared';
import type { RealtimeHorseReportViewed } from '../driver/useDriverRealtime';
import { useDriverNotice } from '../driver/DriverNotices';
import HorseCareCard from './HorseCareCard';
import QuickLogCard from './QuickLogCard';
import TodayCard from './TodayCard';
import CareHistoryList from './CareHistoryList';
import { inRange, latestReportByHorse } from './care-ui';
import { useCareActivities } from './useCareActivities';

/** E1 "Quản lý ngựa": thẻ từng ngựa, ghi nhận nhanh, tổng hôm nay và lịch sử hoạt động của chuyến. */
export default function CareLogPage({ trip, detail, viewedEvent, onTripChanged }: {
  trip: IDriverTripSummary;
  detail: IDriverTripDetail | undefined;
  /** Sự kiện socket "khách đã xem báo cáo" mới nhất (do khung hộ tống nhận) */
  viewedEvent: RealtimeHorseReportViewed | null;
  onTripChanged: () => Promise<void>;
}) {
  const data = useCareActivities(trip.id);
  const notice = useDriverNotice();
  const [editing, setEditing] = useState<ICareActivity | null>(null);
  const now = Date.now();
  const writable = trip.orderStatus === 'READY' || trip.orderStatus === 'IN_TRANSIT';
  const horses = detail?.horses.filter(horse => horse.orderStatus === 'NORMAL') ?? [];
  const reports = useMemo(() => latestReportByHorse(data.logs), [data.logs]);
  const todayRows = useMemo(() => data.activities.filter(activity => inRange(activity, data.range)), [data.activities, data.range]);

  // Khách vừa mở một báo cáo: báo cho hộ tống bằng thông báo nổi rồi tải lại để trạng thái "đã xem" cập nhật.
  const { reload } = data;
  const { reportId } = viewedEvent ?? {};
  useEffect(() => {
    if (!viewedEvent) return;
    const log = data.logs.find(item => item.id === viewedEvent.reportId);
    notice.info(`Khách đã xem báo cáo sức khỏe ${log ? `của ${log.horseName}` : `#${viewedEvent.reportId}`}`);
    void reload();
    // Chỉ phản ứng với sự kiện mới, không với mỗi lần dữ liệu tải lại.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId]);

  if (data.loading) return <div className="drv-loading"><Spin size="large" /><span>Đang tải nhật ký chăm sóc…</span></div>;

  return (
    <div className="esc">
      {data.error && <Alert type="error" showIcon message={data.error} action={<Button size="small" onClick={() => void reload()}>Thử lại</Button>} />}
      {!writable && <Alert type="info" showIcon message="Chuyến không còn nhận nhật ký chăm sóc (đã giao hoặc đã đổi trạng thái). Bạn vẫn xem được lịch sử." />}
      <div className="esc-columns">
        <div className="esc-main">
          {detail && horses.length === 0 ? (
            <section className="drv-card esc-empty"><p>Chuyến chưa có ngựa.</p></section>
          ) : (
            <div className="esc-horses">
              {horses.map(horse => (
                <HorseCareCard
                  key={horse.id} horse={horse} report={reports[horse.id]} lastFeedAt={data.lastFeed[horse.id]} now={now}
                  rows={todayRows.filter(activity => activity.horseId === horse.id)} onEdit={writable ? setEditing : undefined}
                />
              ))}
            </div>
          )}
          <CareHistoryList
            activities={data.activities} onEdit={writable ? setEditing : undefined} running={writable}
            tripStart={trip.legs[0]?.actualDepartureAt ?? trip.legs[0]?.plannedDepartureAt ?? null}
            tripEnd={trip.legs[trip.legs.length - 1]?.actualArrivalAt ?? trip.plannedArrivalAt}
          />
        </div>
        <aside className="esc-side" aria-label="Ghi nhận và tổng hợp">
          <QuickLogCard
            tripId={trip.id} writable={writable} horses={horses} editing={editing}
            onCancelEdit={() => setEditing(null)} onSaved={reload} onTripChanged={onTripChanged}
          />
          <TodayCard summary={data.today} />
        </aside>
      </div>
    </div>
  );
}
