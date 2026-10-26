import { useState } from 'react';
import { Button } from 'antd';
import type { ICareActivity } from '@my-project/shared';
import CareActivityRow from './CareActivityRow';

const PAGE = 10;

/** Lịch sử hoạt động trong chuyến (kể cả nghỉ chân cả đoàn), mới nhất trước; bản đã đính chính đã bị API ẩn. */
export default function CareHistoryList({ activities, onEdit }: { activities: ICareActivity[]; onEdit?: (activity: ICareActivity) => void }) {
  const [shown, setShown] = useState(PAGE);
  return (
    <section className="drv-card esc-history" aria-labelledby="esc-history-title">
      <div className="drv-card-head">
        <h3 id="esc-history-title" className="drv-card-title">Lịch sử hoạt động trong chuyến</h3>
        <span>{activities.length} hoạt động</span>
      </div>
      {activities.length ? (
        <>
          <ul className="esc-rows">
            {activities.slice(0, shown).map(activity => <CareActivityRow key={activity.id} activity={activity} withHorse withDay onEdit={onEdit} />)}
          </ul>
          {shown < activities.length && <Button className="esc-more" onClick={() => setShown(value => value + PAGE)}>Xem thêm</Button>}
        </>
      ) : <p className="esc-none">Chuyến này chưa có hoạt động chăm sóc nào.</p>}
    </section>
  );
}
