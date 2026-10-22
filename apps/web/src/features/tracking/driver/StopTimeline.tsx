import { CheckOutlined } from '@ant-design/icons';
import type { ILegTracking } from '@my-project/shared';
import { tripStops } from './driver-ui';

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/** Thẻ "Các chặng": các điểm dừng theo thứ tự, giờ dự kiến và dấu ✓ khi đã tới. */
export default function StopTimeline({ legs, horseCount }: { legs: ILegTracking[]; horseCount: number }) {
  const stops = tripStops(legs, horseCount);
  return (
    <section className="drv-card drv-stops" aria-labelledby="drv-stops-title">
      <h3 id="drv-stops-title" className="drv-card-title">Các chặng</h3>
      {stops.length === 0 ? <p className="drv-muted">Kế hoạch chuyến chưa có chặng.</p> : (
        <ol>
          {stops.map(stop => (
            <li key={stop.key} className={stop.reached ? 'is-reached' : undefined}>
              <span className="drv-stop-mark" aria-label={stop.reached ? 'Đã tới' : 'Chưa tới'}>
                {stop.reached && <CheckOutlined />}
              </span>
              <span className="drv-stop-text">
                <strong>{stop.name}</strong>
                <small>{stop.note}</small>
              </span>
              <time dateTime={stop.plannedAt}>
                {time.format(new Date(stop.plannedAt))}{stop.dayOffset > 0 && ` +${stop.dayOffset}`}
              </time>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
