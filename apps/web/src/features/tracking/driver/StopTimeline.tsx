import { CheckOutlined, PauseOutlined, TruckOutlined } from '@ant-design/icons';
import type { ILegTracking, ITripMapStop } from '@my-project/shared';
import { tripStops } from './driver-ui';

const time = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });

/**
 * Thẻ "Các chặng": các điểm dừng theo thứ tự, giờ dự kiến và 3 trạng thái
 * ✓ đã qua · 🚚 đang tới (điểm đến của chặng đang chạy) · ⏸ đang dừng (xe đứng tại điểm này) · → kế tiếp (khi đang dừng) · ○ chưa tới.
 * Các trạng thái chạy/dừng chỉ có khi `running` (chuyến IN_TRANSIT).
 */
export default function StopTimeline({ legs, horseCount, running = false, mapStops }: { legs: ILegTracking[]; horseCount: number; running?: boolean; mapStops?: ITripMapStop[] }) {
  const stops = tripStops(legs, horseCount, running, mapStops);
  return (
    <section className="drv-card drv-stops" aria-labelledby="drv-stops-title">
      <h3 id="drv-stops-title" className="drv-card-title">Các chặng</h3>
      {stops.length === 0 ? <p className="drv-muted">Kế hoạch chuyến chưa có chặng.</p> : (
        <ol>
          {stops.map(stop => (
            <li key={stop.key} className={stop.stopped ? 'is-stopped' : stop.reached ? 'is-reached' : stop.current ? 'is-current' : stop.next ? 'is-next' : undefined} aria-current={stop.current || stop.next ? 'step' : undefined}>
              <span className="drv-stop-mark" aria-label={stop.stopped ? 'Đang dừng' : stop.reached ? 'Đã tới' : stop.current ? 'Đang tới' : stop.next ? 'Kế tiếp' : 'Chưa tới'}>
                {stop.stopped ? <PauseOutlined /> : stop.reached ? <CheckOutlined /> : stop.current ? <TruckOutlined /> : null}
              </span>
              <span className="drv-stop-text">
                <strong>{stop.name}</strong>
                <small>{stop.note}</small>
              </span>
              {stop.plannedAt && (
                <time dateTime={stop.plannedAt}>
                  {time.format(new Date(stop.plannedAt))}{stop.dayOffset > 0 && ` +${stop.dayOffset}`}
                </time>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
