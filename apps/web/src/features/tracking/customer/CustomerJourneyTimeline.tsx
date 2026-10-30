import type { IOrderTimeline } from '@my-project/shared';

/** Một mốc trong dòng thời gian của khách (giống trang theo dõi đơn của sàn thương mại điện tử). */
type JourneyEvent = { key: string; at: string; title: string; detail: string | null };

const dayMonth = new Intl.DateTimeFormat('vi-VN', { day: 'numeric', month: 'numeric' });
const hourMinute = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit' });
const DAY_MS = 86_400_000;

/** "29 Thg 10" theo giờ máy khách. */
function shortDate(value: string | number | Date) {
  const [day, month] = dayMonth.format(new Date(value)).split('/');
  return `${day} Thg ${month}`;
}

/** Cột giờ bên trái: "Hôm nay / 14:22" hoặc "28 Thg 10 / 14:52". */
function whenLabel(iso: string, now: number) {
  const date = new Date(iso);
  const today = new Date(now).toDateString() === date.toDateString();
  const yesterday = new Date(now - DAY_MS).toDateString() === date.toDateString();
  return { day: today ? 'Hôm nay' : yesterday ? 'Hôm qua' : shortDate(date), time: hourMinute.format(date) };
}

/** Mốc tài xế ghi → câu dễ hiểu cho khách. Điểm cuối chặng cuối là điểm nhận ngựa. */
function events(timeline: IOrderTimeline): JourneyEvent[] {
  const last = timeline.legs.length - 1;
  const list = timeline.legs.flatMap((leg, index) => leg.milestones.map(m => {
    const end = index === last;
    const title = {
      DEPARTED: index === 0 ? 'Tài xế đã bắt đầu chuyến đi' : `Xe đã rời ${leg.fromLocationName}`,
      ARRIVED_AT_STOP: end ? 'Xe đã đến điểm nhận ngựa' : `Xe đã đến ${leg.toLocationName}`,
      CUSTOMS_CLEARED: `Đã thông quan tại ${leg.toLocationName}`,
      DELIVERED: 'Giao ngựa thành công',
    }[m.milestoneType] ?? m.milestoneType;
    const detail = m.milestoneType === 'DEPARTED' ? `Xuất phát từ ${leg.fromLocationName}, đang trên đường đến ${leg.toLocationName}`
      : m.milestoneType === 'DELIVERED' ? `Ngựa đã được bàn giao tại ${leg.toLocationName}`
      : end && m.milestoneType === 'ARRIVED_AT_STOP' ? `${leg.toLocationName} · đang chờ bàn giao ngựa` : null;
    return { key: `${leg.seqNo}-${m.milestoneType}-${m.occurredAt}`, at: m.occurredAt, title, detail };
  }));
  // Điểm nghỉ giữa đường tài xế đã check-in (lộ trình có nhiều điểm dừng).
  const stops = timeline.legs.flatMap(leg => (leg.waypointCheckins ?? []).map(c => ({
    key: `wp-${leg.seqNo}-${c.waypointId}`, at: c.occurredAt, title: `Xe đã đến điểm dừng ${c.label}`, detail: 'Điểm nghỉ trên hành trình · xe sẽ tiếp tục sau khi nghỉ',
  })));
  // Mới nhất trên cùng.
  return [...list, ...stops].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

const STEPS = ['Sẵn sàng khởi hành', 'Đã xuất phát', 'Đang vận chuyển', 'Đã đến điểm nhận', 'Đã giao ngựa'];

/** Bước hiện tại trên thanh tiến trình (0–4) suy từ trạng thái đơn và mốc của chặng cuối. */
function stepOf(timeline: IOrderTimeline) {
  if (timeline.orderStatus === 'DELIVERED') return 4;
  const lastLeg = timeline.legs[timeline.legs.length - 1];
  if (lastLeg?.milestones.some(m => m.milestoneType === 'ARRIVED_AT_STOP') || lastLeg?.status === 'AT_STOP') return 3;
  const departed = timeline.legs.some(leg => leg.milestones.some(m => m.milestoneType === 'DEPARTED'));
  if (!departed) return 0;
  // Đã qua ít nhất một điểm dừng giữa đường (hoặc chặng đầu đã xong) → đang vận chuyển.
  return timeline.legs.some(leg => leg.status === 'COMPLETED' || leg.milestones.length > 1 || (leg.waypointCheckins?.length ?? 0) > 0) ? 2 : 1;
}

/**
 * Theo dõi hành trình của khách, hai phần:
 * 1. Đầu thẻ: "Dự kiến giao từ … đến …" (khung một ngày sau giờ đến dự kiến) hoặc "Giao vào …" khi đã giao, kèm thanh 5 bước.
 * 2. Dòng thời gian các mốc tài xế đã ghi: mốc mới nhất trên cùng, có màu; các mốc cũ màu xám.
 */
export default function CustomerJourneyTimeline({ timeline, now = Date.now() }: { timeline: IOrderTimeline; now?: number }) {
  const list = events(timeline);
  const step = stepOf(timeline);
  const delivered = list.find(event => event.title === 'Giao ngựa thành công');
  const arrival = timeline.plannedArrivalAt;
  const first = timeline.legs[0], lastLeg = timeline.legs[timeline.legs.length - 1];
  return (
    <>
      <section className="portal-panel trk-panel trk-journey-head" aria-label="Thời gian giao dự kiến">
        <p className="trk-journey-code">{timeline.orderCode}{first && lastLeg ? ` · ${first.fromLocationName} → ${lastLeg.toLocationName}` : ''}</p>
        <h2 className={delivered ? 'is-done' : undefined}>
          {delivered ? `Giao vào ${shortDate(delivered.at)}`
            : arrival ? `Dự kiến giao từ ${shortDate(arrival)} đến ${shortDate(Date.parse(arrival) + DAY_MS)}`
            : 'Chưa có lịch giao dự kiến'}
        </h2>
        <ol className="trk-journey-steps" aria-label="Tiến trình chuyến">
          {STEPS.map((label, index) => (
            <li key={label} className={index < step ? 'is-past' : index === step ? 'is-current' : undefined} aria-current={index === step ? 'step' : undefined}>
              <span className="trk-journey-dot" aria-hidden="true">{index === step && index === STEPS.length - 1 ? '✓' : ''}</span>
              <span>{label}</span>
            </li>
          ))}
        </ol>
      </section>

      <section className="portal-panel trk-panel" aria-label="Lịch sử hành trình">
        <div className="portal-panel-heading"><h2>Lịch sử hành trình</h2></div>
        {list.length === 0 ? (
          <p className="trk-muted">Chuyến đã sẵn sàng. Các mốc sẽ hiện ở đây ngay khi tài xế cập nhật.</p>
        ) : (
          <ol className="trk-events">
            {list.map((event, index) => {
              const when = whenLabel(event.at, now);
              return (
                <li key={event.key} className={index === 0 ? 'is-latest' : undefined}>
                  <time dateTime={event.at}><span>{when.day}</span><span>{when.time}</span></time>
                  <span className="trk-event-dot" aria-hidden="true" />
                  <div>
                    <strong>{event.title}</strong>
                    {event.detail && <p>{event.detail}</p>}
                  </div>
                </li>
              );
            })}
          </ol>
        )}
      </section>
    </>
  );
}
