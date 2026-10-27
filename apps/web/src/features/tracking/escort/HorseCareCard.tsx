import { ClockCircleOutlined } from '@ant-design/icons';
import { HORSE_CONDITION_META, type ICareActivity, type IHorseLog, type ITripHorse } from '@my-project/shared';
import { HorseIcon } from '../driver/icons';
import { timeAgo } from '../../notifications/time-ago';
import CareActivityRow from './CareActivityRow';
import { horseSubtitle } from './care-ui';

/**
 * Thẻ một ngựa (Figma E1): tên, giống · tuổi, trạng thái của báo cáo đã gửi mới nhất, "Lần cho ăn gần nhất" và các hoạt động hôm nay.
 * Khác Figma: không có lịch "Bữa tiếp theo" (quyết định 5.1) và không có "khoang n" (API không có dữ liệu này).
 */
export default function HorseCareCard({ horse, report, lastFeedAt, rows, now, onEdit }: {
  horse: ITripHorse;
  /** Báo cáo sức khỏe đã gửi mới nhất; undefined = chưa có */
  report: IHorseLog | undefined;
  lastFeedAt: string | undefined;
  /** Hoạt động hôm nay của ngựa này, mới nhất trước */
  rows: ICareActivity[];
  now: number;
  onEdit?: (activity: ICareActivity) => void;
}) {
  const meta = report ? HORSE_CONDITION_META[report.conditionStatus] : null;
  return (
    <section className="drv-card esc-horse" aria-label={`Ngựa ${horse.name}`} data-horse-id={horse.id}>
      <header className="esc-horse-head">
        <span className="esc-horse-photo" aria-hidden="true"><HorseIcon /></span>
        <span className="esc-horse-name">
          <strong>{horse.name}</strong>
          <small>{horseSubtitle(horse, now)}</small>
        </span>
        <span className={'esc-badge ' + (report ? 'is-' + report.conditionStatus.toLowerCase() : 'is-none')}>{meta ? meta.label : 'Chưa có báo cáo'}</span>
      </header>
      <p className="esc-lastfeed"><ClockCircleOutlined aria-hidden="true" />
        {lastFeedAt ? `Lần cho ăn gần nhất: ${timeAgo(lastFeedAt, now)}` : 'Chưa ghi bữa ăn nào'}
      </p>
      {rows.length ? (
        <ul className="esc-rows" aria-label={`Hoạt động hôm nay của ${horse.name}`}>
          {rows.map(activity => <CareActivityRow key={activity.id} activity={activity} onEdit={onEdit} />)}
        </ul>
      ) : <p className="esc-none">Chưa có hoạt động nào hôm nay.</p>}
    </section>
  );
}
