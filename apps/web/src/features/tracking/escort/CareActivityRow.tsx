import { Button } from 'antd';
import { CareActivityType, type ICareActivity } from '@my-project/shared';
import { DropIcon, FeedIcon, RestIcon } from '../driver/icons';
import { activityDetail, careLabel, clock, clockWithDay } from './care-ui';

const ICON: Record<CareActivityType, JSX.Element> = {
  [CareActivityType.FEED]: <FeedIcon />,
  [CareActivityType.WATER]: <DropIcon />,
  [CareActivityType.REST]: <RestIcon />,
};

/**
 * Một hoạt động chăm sóc đã ghi (Figma E1 "Schedule" nhưng là nhật ký thực tế, không có Sắp tới / Xác nhận).
 * "Sửa" tạo bản đính chính; không có nút xóa (quyết định 6.3).
 */
export default function CareActivityRow({ activity, withHorse = false, withDay = false, onEdit }: {
  activity: ICareActivity;
  /** Hiện tên ngựa ("Cả đoàn" khi không gắn ngựa): dùng ở danh sách lịch sử, thẻ ngựa đã rõ ngựa nào */
  withHorse?: boolean;
  withDay?: boolean;
  /** Không truyền = chỉ xem (đơn đã giao) */
  onEdit?: (activity: ICareActivity) => void;
}) {
  const time = withDay ? clockWithDay(activity.performedAt) : clock(activity.performedAt);
  const label = careLabel(activity.activityType);
  return (
    <li className="esc-row" data-activity-id={activity.id}>
      <time className="esc-row-time" dateTime={activity.performedAt}>{time}</time>
      <span className={'esc-icon is-' + activity.activityType.toLowerCase()} aria-hidden="true">{ICON[activity.activityType]}</span>
      <span className="esc-row-main">
        <strong>{label}{withHorse && ` · ${activity.horseName ?? 'Cả đoàn'}`}</strong>
        <small title={activityDetail(activity)}>{activityDetail(activity) || '—'}</small>
      </span>
      {activity.correctsActivityId && <span className="esc-tag">Bản đính chính</span>}
      {onEdit && (
        <Button size="small" className="esc-edit" aria-label={`Sửa ${label.toLowerCase()} lúc ${time}${withHorse ? ` · ${activity.horseName ?? 'Cả đoàn'}` : ''}`} onClick={() => onEdit(activity)}>
          Sửa
        </Button>
      )}
    </li>
  );
}
