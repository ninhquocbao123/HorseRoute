import type { IOrderTimeline } from "../../../packages/shared/src/types/tracking.type";

/**
 * Dòng thời gian hành trình của khách trên app (mục 7), cùng thứ tự và câu chữ với web
 * (apps/web/src/features/tracking/customer/CustomerJourneyTimeline.tsx): mốc tài xế đã ghi, MỚI NHẤT TRÊN CÙNG.
 * Thêm cho app: ảnh trong chuyến gắn vào mốc gần nhất trước lúc chụp, và danh sách điểm sắp tới.
 */
export type JourneyPhoto = { id: string; at: string; caption?: string; place?: string | null };
export type JourneyEvent = {
  key: string;
  at: string;
  title: string;
  detail: string | null;
  /** Nơi xảy ra mốc (để ghi dưới ảnh trong trình xem). */
  place: string;
  photos: JourneyPhoto[];
};
export type UpcomingStop = { key: string; name: string; plannedAt: string | null };

const strip = (label: string) => label.replace(/\s*–\s*đã qua cửa khẩu$/, "");

export function journeyEvents(timeline: Pick<IOrderTimeline, "legs">, photos: JourneyPhoto[] = []): JourneyEvent[] {
  const legs = [...timeline.legs].sort((a, b) => a.seqNo - b.seqNo);
  const last = legs.length - 1;
  const list: JourneyEvent[] = legs.flatMap((leg, index) =>
    leg.milestones.map((m) => {
      const end = index === last;
      const title =
        ({
          DEPARTED: index === 0 ? "Tài xế đã bắt đầu chuyến đi" : `Xe đã rời ${leg.fromLocationName}`,
          ARRIVED_AT_STOP: end ? "Xe đã đến điểm giao" : `Xe đã đến ${leg.toLocationName}`,
          CUSTOMS_CLEARED: `Đã thông quan tại ${leg.toLocationName}`,
          DELIVERED: "Giao ngựa thành công",
        } as Record<string, string>)[m.milestoneType] ?? m.milestoneType;
      const detail =
        m.milestoneType === "DEPARTED"
          ? `Xuất phát từ ${leg.fromLocationName}, đang trên đường đến ${leg.toLocationName}`
          : m.milestoneType === "DELIVERED"
            ? `Ngựa đã được bàn giao tại ${leg.toLocationName}`
            : end && m.milestoneType === "ARRIVED_AT_STOP"
              ? `${leg.toLocationName} · đang chờ bàn giao ngựa`
              : null;
      return {
        key: `${leg.seqNo}-${m.milestoneType}-${m.occurredAt}`,
        at: m.occurredAt,
        title,
        detail,
        place: m.milestoneType === "DEPARTED" ? leg.fromLocationName : leg.toLocationName,
        photos: [],
      };
    }),
  );
  const stops: JourneyEvent[] = legs.flatMap((leg) =>
    (leg.waypointCheckins ?? []).map((c) => ({
      key: `wp-${leg.seqNo}-${c.waypointId}`,
      at: c.occurredAt,
      place: strip(c.label),
      photos: [],
      ...(c.borderStage === "ARRIVED"
        ? { title: `Xe đang ở ${c.label}`, detail: "Đang kiểm tra giấy tờ thông quan" }
        : c.borderStage === "CLEARED"
          ? { title: `Đã qua cửa khẩu: ${strip(c.label)}`, detail: "Đã thông quan, xe tiếp tục hành trình" }
          : { title: `Xe đã đến điểm dừng ${c.label}`, detail: "Điểm nghỉ trên hành trình · xe sẽ tiếp tục sau khi nghỉ" }),
    })),
  );
  const events = [...list, ...stops].sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  // Ảnh thuộc mốc gần nhất trước lúc chụp; chụp trước mọi mốc thì gắn vào mốc đầu tiên.
  for (const photo of photos) {
    const time = Date.parse(photo.at);
    const owner = events.find((e) => Date.parse(e.at) <= time) ?? events[events.length - 1];
    if (owner) owner.photos.push({ ...photo, place: photo.place ?? owner.place });
  }
  for (const e of events) e.photos.sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
  return events;
}

/** Điểm chưa tới: điểm cuối các chặng chưa xong (theo thứ tự đi), hiện khác màu với mốc đã qua. */
export function upcomingStops(timeline: Pick<IOrderTimeline, "legs">): UpcomingStop[] {
  return [...timeline.legs]
    .sort((a, b) => a.seqNo - b.seqNo)
    .filter((leg) => leg.status !== "COMPLETED" && leg.status !== "AT_STOP" && !leg.milestones.some((m) => m.milestoneType === "ARRIVED_AT_STOP"))
    .map((leg) => ({ key: `up-${leg.seqNo}`, name: leg.toLocationName, plannedAt: leg.plannedArrivalAt ?? null }));
}

export const JOURNEY_STEPS = ["Sẵn sàng khởi hành", "Đã xuất phát", "Đang vận chuyển", "Đã đến điểm nhận", "Đã giao ngựa"];

/** Bước hiện tại 0–4 (giống web stepOf). */
export function journeyStep(timeline: Pick<IOrderTimeline, "legs" | "orderStatus">) {
  if (timeline.orderStatus === "DELIVERED") return 4;
  const legs = [...timeline.legs].sort((a, b) => a.seqNo - b.seqNo);
  const lastLeg = legs[legs.length - 1];
  if (lastLeg?.milestones.some((m) => m.milestoneType === "ARRIVED_AT_STOP") || lastLeg?.status === "AT_STOP") return 3;
  const departed = legs.some((leg) => leg.milestones.some((m) => m.milestoneType === "DEPARTED"));
  if (!departed) return 0;
  return legs.some((leg) => leg.status === "COMPLETED" || leg.milestones.length > 1 || (leg.waypointCheckins?.length ?? 0) > 0) ? 2 : 1;
}
