import type {
  IDriverTripDetail,
  ITripMap,
  Profile,
  ProfileInput,
  OrderPayload,
  OrderDetail,
} from "./api/types";

export const statuses: Record<string, string> = {
  DRAFT: "Nháp",
  PENDING: "Chờ duyệt",
  NEED_INFO: "Cần bổ sung",
  REJECTED: "Từ chối",
  APPROVED: "Đã duyệt",
  PREPARING: "Đang chuẩn bị",
  READY: "Sẵn sàng",
  IN_TRANSIT: "Đang vận chuyển",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã hủy",
  NOT_STARTED: "Chưa bắt đầu",
  MOVING: "Đang di chuyển",
  AT_STOP: "Đã đến điểm dừng",
  COMPLETED: "Hoàn thành",
  NEW: "Mới",
  ACKNOWLEDGED: "Đã tiếp nhận",
  CLOSED: "Đã đóng",
  SENT: "Đã gửi",
  STABLE: "Ổn định",
  OFF_FEED: "Bỏ ăn",
  STRESSED: "Căng thẳng",
  CLIMATE_CHANGE: "Khí hậu thay đổi",
  NORMAL: "Bình thường",
  REDUCED: "Ăn ít",
  REFUSED: "Không ăn",
  NOT_SUBMITTED: "Chưa nộp",
  SUBMITTED: "Đã nộp",
  VALID: "Hợp lệ",
  INVALID: "Không hợp lệ",
  EXPIRED: "Hết hạn",
  FEED: "Cho ăn",
  WATER: "Uống nước",
  REST: "Nghỉ chân",
  VEHICLE_BREAKDOWN: "Hỏng xe",
  LONG_TRAFFIC_JAM: "Tắc đường",
  HORSE_MEDICAL: "Y tế ngựa",
  DELIVERY_ISSUE: "Giao ngựa",
  RED: "Nghiêm trọng",
  ORANGE: "Trung bình",
  YELLOW: "Nhẹ",
  DEPARTED: "Xuất phát",
  ARRIVED_AT_STOP: "Đã đến điểm dừng",
  CUSTOMS_CLEARED: "Đã thông quan",
};
export const label = (value: string | null | undefined) =>
  value ? (statuses[value] ?? value) : "Chưa cập nhật";
/** Giờ phút rồi ngày: 16:01 14/11/2026 (không hiện giây). */
export const dateTime = (value: string | null | undefined) => {
  if (!value || !Number.isFinite(Date.parse(value))) return "Chưa cập nhật";
  const d = new Date(value);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
};
export const money = (value: string | number | null | undefined) =>
  value !== null && value !== undefined && Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString("vi-VN")} ₫`
    : "Chưa có báo giá";
/** B8: số kiểu Việt Nam, bỏ số 0 thừa: "30.00" → "30", "8.375" → "8,38". */
export const num = (value: string | number | null | undefined, digits = 2) =>
  Number(value ?? 0).toLocaleString("vi-VN", { maximumFractionDigits: digits });
/** Dòng hạng mục báo giá: nhãn đã ghi số lượng (ví dụ "Vượt 238 km × 15.750 đ/km") thì không ghép thêm "× 238". */
export const quoteLineLabel = (item: { label: string; quantity: number | string }) =>
  Number(item.quantity) > 1 && !item.label.includes("×") ? `${item.label} × ${num(item.quantity)}` : item.label;
export const asId = (value: string | number) =>
  encodeURIComponent(String(value));
export const checks = [
  "Lốp, phanh, đèn đã kiểm tra",
  "Khoang ngựa vệ sinh, có lót sàn",
  "Nước và thức ăn đủ theo kế hoạch chuyến",
  "Giấy kiểm dịch mang theo",
  "Ngựa đã lên xe và cố định",
];
/** Lưu trong checklist khi tài xế chọn "Vẫn tiếp tục" lúc còn mục chưa tick. */
export const CONTINUE_ANYWAY = "__continue";
export const emptyProfile: ProfileInput = {
  name: "",
  passportNo: "",
  breed: "",
  birthDate: "",
  sex: "",
  coatColor: "",
  microchip: "",
  weightKg: null,
  heightCm: null,
  ownerName: "",
  feed: "",
  note: "",
  documentNote: "",
};
/** Đơn còn sửa tiếp được từ nháp trên máy; trạng thái khác nghĩa là nháp đã gửi hoặc đã đóng. */
/** Ngày theo giờ máy, dạng YYYY-MM-DD mà API nhận. */
export const ymd = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
export const fromYmd = (value: string) => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null;
};
/** Ngày không kèm giờ, kiểu 05/11/2026. */
export const day = (value: string | null | undefined) => {
  const d = value ? fromYmd(value.slice(0, 10)) : null;
  return d ? d.toLocaleDateString("vi-VN") : "Chưa chọn ngày";
};
export const canResumeDraft = (status: string) =>
  ["DRAFT", "NEED_INFO"].includes(status);
/** Máy chủ từ chối báo cáo gửi khách mà không có ghi chú gửi khách. */
export const customerNoteError = (sendToCustomer: boolean, note: string) =>
  sendToCustomer && !note.trim()
    ? "Nhập ghi chú gửi khách, hoặc tắt Gửi cho khách xem."
    : null;
export type PaymentAction =
  | { kind: "none"; note: string | null; expired?: boolean }
  | {
      kind: "pay";
      type: "DEPOSIT" | "BALANCE";
      amount: number;
      note: string;
      /** Xe đã tới điểm giao, tài xế đang đợi. */
      urgent: boolean;
    };
/**
 * Nút thanh toán của CUS-04 và các thẻ trang chủ (kế hoạch 10, mục 4). Khớp quy tắc máy chủ:
 * báo giá hết hạn chỉ chặn khi chưa đủ cọc; đã cọc đủ thì vẫn trả tiếp được.
 */
export function paymentAction(
  order: { status: string; arrivedAtDelivery?: boolean | number | string | null },
  quote: {
    total: string | number;
    deposit: string | number;
    paid?: string | number | null;
    expires_at?: string | null;
  },
  now = Date.now(),
): PaymentAction {
  const total = Number(quote.total);
  const deposit = Number(quote.deposit);
  const paid = Number(quote.paid ?? 0);
  if (paid >= total) return { kind: "none", note: "Đã thanh toán đủ" };
  if (
    !["APPROVED", "PREPARING", "READY", "IN_TRANSIT", "DELIVERED"].includes(
      order.status,
    )
  )
    return { kind: "none", note: null };
  if (paid < deposit) {
    if (quote.expires_at && Date.parse(quote.expires_at) <= now)
      return {
        kind: "none",
        expired: true,
        note: "Báo giá đã hết hạn. Liên hệ quản lý để báo giá lại.",
      };
    return {
      kind: "pay",
      type: "DEPOSIT",
      amount: deposit - paid,
      note: "Đặt cọc xong, đơn chuyển sang chuẩn bị chuyến.",
      urgent: false,
    };
  }
  // Máy chủ cũ trả "0"/"1" dạng chữ: "0" không được coi là xe đã tới.
  const arrived = order.arrivedAtDelivery === true || Number(order.arrivedAtDelivery) === 1;
  const urgent = arrived && order.status === "IN_TRANSIT";
  return {
    kind: "pay",
    type: "BALANCE",
    amount: total - paid,
    urgent,
    note: urgent
      ? "Xe đã tới. Tài xế đang đợi bạn thanh toán để giao ngựa."
      : order.status === "DELIVERED"
        ? "Ngựa đã giao. Bạn còn khoản này phải thanh toán."
        : "Cần trả đủ trước khi tài xế giao ngựa.",
  };
}
/**
 * Thời gian còn lại để đặt cọc (ms), hoặc null khi không còn hạn nào phải nhắc:
 * báo giá không có hạn, hoặc khách đã cọc đủ (hạn báo giá chỉ áp cho tiền cọc).
 */
export function depositTimeLeft(
  quote: { deposit: string | number; paid?: string | number | null; expires_at?: string | null },
  now = Date.now(),
): number | null {
  if (!quote.expires_at) return null;
  if (Number(quote.paid ?? 0) >= Number(quote.deposit)) return null;
  return Date.parse(quote.expires_at) - now;
}
/** Cửa sổ ghi lùi của mốc và ghi chăm sóc từ hàng chờ (G3 phương án A). */
export const BACKFILL_MS = 24 * 3600000;
/**
 * Lần gần nhất đồng hồ chỉ giờ:phút đã chọn: chọn 23:50 lúc 00:30 nghĩa là 23:50 hôm qua, không phải giờ tương lai.
 * Luôn tính từ hiện tại nên chọn lại nhiều lần không bị lệch ngày.
 */
export function pastClock(hours: number, minutes: number, now = new Date()) {
  const at = new Date(now);
  at.setHours(hours, minutes, 0, 0);
  if (at.getTime() > now.getTime()) at.setDate(at.getDate() - 1);
  return at;
}
type QueueWire = {
  id: string;
  kind: string;
  createdAt: number;
  timeField: string | null;
};
/** Trường thêm khi gửi một mục hàng chờ: chống trùng (G2) và giờ vào hàng chờ để được ghi bù 24 giờ (G3). */
export function queueWireFields(item: QueueWire) {
  return {
    ...(["incident", "care", "horseLog"].includes(item.kind)
      ? { clientRequestId: item.id }
      : {}),
    ...(item.timeField === "occurredAt" || item.timeField === "performedAt"
      ? { queuedAt: new Date(item.createdAt).toISOString() }
      : {}),
  };
}
/**
 * Lần gửi trước mất phản hồi nên không biết máy chủ đã ghi chưa. Mốc đã ghi rồi thì lần này trả 409,
 * nghĩa là mốc đã đến nơi, không phải bị từ chối. Màn chuyến tải lại đúng trạng thái từ máy chủ.
 */
export const isReplayConflict = (
  item: { kind: string; lastFailure?: string },
  status: number,
) =>
  status === 409 &&
  !!item.lastFailure &&
  ["milestone", "checkin", "complete"].includes(item.kind);
/**
 * B8: lý do lần gửi trước chưa được, viết cho tài xế đọc. Lỗi kỹ thuật (ví dụ "java.net.ConnectException: Failed to connect
 * to /10.0.2.2:3100") đổi thành câu dễ hiểu; câu tiếng Việt của máy chủ thì giữ nguyên.
 */
export function queueFailureText(raw: string | undefined) {
  if (!raw) return "";
  const text = raw.toLowerCase();
  if (/timeout|timed out|quá thời gian/.test(text)) return "Máy chủ phản hồi quá lâu. Ứng dụng sẽ tự gửi lại.";
  if (/connect|network|unreachable|econnrefused|enotfound|failed to fetch|socket|unknownhost|mạng/.test(text))
    return "Chưa kết nối được máy chủ (mất sóng hoặc máy chủ đang tắt). Ứng dụng sẽ tự gửi lại khi có kết nối.";
  if (/too many|429|quá nhiều/.test(text)) return "Máy chủ đang bận. Ứng dụng sẽ tự gửi lại sau ít phút.";
  if (/[ăâđêôơưạảấầẩẫậắằẳẵặẹẻẽếềểễệỉịọỏốồổỗộớờởỡợụủứừửữựỳỵỷỹ]/.test(text)) return raw;
  return "Máy chủ tạm thời chưa nhận được. Ứng dụng sẽ tự gửi lại.";
}
/** Chỉ tắt GPS của đúng chuyến đang gửi: mở một chuyến đã giao không được tắt chuyến đang chạy. */
export const shouldStopTracking = (
  trackedTripId: string | null,
  tripId: string,
) => !trackedTripId || trackedTripId === tripId;
export function profilePayload(profile: Profile | ProfileInput): ProfileInput {
  const {
    name,
    passportNo,
    breed,
    birthDate,
    sex,
    coatColor,
    microchip,
    weightKg,
    heightCm,
    ownerName,
    feed,
    note,
    documentNote,
    revision,
  } = { ...emptyProfile, ...profile };
  return {
    name,
    passportNo,
    breed,
    // Chưa chọn ngày sinh thì không gửi: máy chủ không nhận chuỗi rỗng.
    ...(birthDate ? { birthDate } : {}),
    sex,
    coatColor,
    microchip,
    weightKg,
    heightCm,
    ownerName,
    feed,
    note,
    documentNote,
    ...(revision ? { revision } : {}),
  };
}
export function validDate(value: string) {
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    Number.isFinite(Date.parse(value)) &&
    new Date(value).toISOString().slice(0, 10) === value
  );
}
export function orderPayload(
  input: Omit<OrderPayload, "horses">,
  selected: string[],
  profiles: Profile[],
  /** Đơn nháp đang sửa: ngựa gắn với chính đơn này không tính là bận. */
  ownOrderId?: string,
): OrderPayload {
  if (!selected.length) throw new Error("Chọn ít nhất một ngựa.");
  const horses = selected.map((id) => {
    const horse = profiles.find((item) => String(item.id) === id);
    if (
      !horse ||
      (horse.activeOrderId && String(horse.activeOrderId) !== ownOrderId)
    )
      throw new Error(
        "Hồ sơ đã thay đổi hoặc ngựa đang trên đơn khác. Hãy chọn lại.",
      );
    if (!horse.passportNo.trim())
      throw new Error(
        `${horse.name} chưa có số hộ chiếu. Cập nhật hồ sơ trước khi gửi đơn.`,
      );
    return {
      profileId: String(horse.id),
      name: horse.name,
      passportNo: horse.passportNo,
      breed: horse.breed,
      birthDate: horse.birthDate || undefined,
      sex: horse.sex,
      coatColor: horse.coatColor,
      note: horse.note,
    };
  });
  return { ...input, horses };
}
export function fromOrder(order: OrderDetail): OrderPayload {
  if (order.draft) return order.draft;
  return {
    originAddress: order.origin_address || "",
    originCountry: order.origin_country || "",
    destinationAddress: order.destination_address || "",
    destinationCountry: order.destination_country || "",
    desiredDepartureDate: order.desired_departure_date?.slice(0, 10) || "",
    specialRequirements: order.special_requirements || "",
    horses: order.horses.map((h) => ({
      id: String(h.id),
      name: h.name,
      passportNo: h.passport_no,
      breed: h.breed || "",
      birthDate: h.birth_date || undefined,
      sex: h.sex || "",
      coatColor: h.coat_color || "",
      note: h.note || "",
    })),
  };
}
export type DriverAction = {
  label: string;
  path: string;
  body: { milestoneType?: string };
  legId: string;
  needsChecklist: boolean;
  kind: "milestone" | "checkin" | "complete";
  waypointId?: string;
  /** Tên đầy đủ của nơi ghi mốc, hiện trong hộp xác nhận. */
  placeName: string;
  /**
   * Quyết định 29/10: đến/rời điểm dừng ghi ngay 1 chạm + Hoàn tác 5 giây.
   * Xuất phát chuyến, thông quan và giao ngựa vẫn qua hộp xác nhận.
   */
  confirm: boolean;
};
export function driverAction(
  trip: IDriverTripDetail,
  map?: ITripMap | null,
): DriverAction | null {
  if (
    trip.crewRole !== "DRIVER" ||
    trip.planStatus !== "APPROVED" ||
    !["READY", "IN_TRANSIT"].includes(trip.orderStatus)
  )
    return null;
  const legs = [...trip.legs].sort((a, b) => a.seqNo - b.seqNo);
  const leg =
    legs.find((l) => l.status === "MOVING" || l.status === "AT_STOP") ??
    legs.find((l) => l.status !== "COMPLETED");
  if (!leg) return null;
  const base = `/tracking/legs/${asId(leg.id)}`;
  const first = leg.seqNo === legs[0].seqNo;
  const result = (
    title: string,
    type: string,
    placeName: string,
    confirm: boolean,
    needsChecklist = false,
  ): DriverAction => ({
    label: title,
    path: `${base}/milestones`,
    body: { milestoneType: type },
    legId: leg.id,
    needsChecklist,
    kind: "milestone",
    placeName,
    confirm,
  });
  if (leg.status === "NOT_STARTED") {
    const previous = legs.find((l) => l.seqNo === leg.seqNo - 1);
    if (
      (previous && previous.status !== "COMPLETED") ||
      (first && trip.orderStatus !== "READY")
    )
      return null;
    return first
      ? result("Bắt đầu chuyến", "DEPARTED", leg.fromLocationName, true, true)
      : result(
          `Rời ${shortName(leg.fromLocationName)}`,
          "DEPARTED",
          leg.fromLocationName,
          false,
        );
  }
  if (leg.status === "MOVING") {
    // A single representative leg uses ordered route-plan waypoint IDs from the map API.
    // Do not guess IDs or offer arrival if the map failed to load.
    if (legs.length === 1) {
      if (!map) return null;
      const next = nextRestStop(map, leg.waypointCheckins);
      if (next)
        return {
          // Cửa khẩu có hai điểm: phía rời đi (đã đến cửa khẩu) và phía bên kia (đã qua cửa khẩu).
          label: /đã qua cửa khẩu$/.test(next.name)
            ? `Đã qua cửa khẩu ${shortName(next.name.replace(/\s*–\s*đã qua cửa khẩu$/, "")).replace(/^Cửa khẩu\s+/i, "")}`
            : `Đã đến ${shortName(next.name)}`,
          path: `${base}/waypoints/${asId(next.locationId)}/checkin`,
          body: {},
          legId: leg.id,
          needsChecklist: false,
          kind: "checkin",
          waypointId: next.locationId,
          placeName: next.name,
          confirm: false,
        };
    }
    return result(
      `Đã đến ${shortName(leg.toLocationName)}`,
      "ARRIVED_AT_STOP",
      leg.toLocationName,
      false,
    );
  }
  if (leg.status === "AT_STOP") {
    if (
      leg.toLocationType === "BORDER" &&
      !leg.milestones.some((m) => m.milestoneType === "CUSTOMS_CLEARED")
    )
      return result(
        "Đã thông quan",
        "CUSTOMS_CLEARED",
        leg.toLocationName,
        true,
      );
    if (leg.id === legs[legs.length - 1].id)
      return result(
        "Đã giao ngựa an toàn",
        "DELIVERED",
        leg.toLocationName,
        true,
      );
    return {
      label: `Xong ${shortName(leg.toLocationName)}, đi tiếp`,
      path: `${base}/complete`,
      body: {},
      legId: leg.id,
      needsChecklist: false,
      kind: "complete",
      placeName: leg.toLocationName,
      confirm: false,
    };
  }
  return null;
}

function nextRestStop(map: ITripMap, checkins: { waypointId: string }[]) {
  return map.stops
    .slice(1, -1)
    .filter((stop) => stop.locationType === "REST_STOP" || stop.locationType === "BORDER")
    .find((stop) => !checkins.some((c) => c.waypointId === stop.locationId));
}

/** Lộ trình trên màn tài xế. Chuyến một chặng hiện cả các điểm nghỉ trong kế hoạch tuyến. */
export function tripTimeline(
  trip: IDriverTripDetail,
  map: ITripMap | null | undefined,
  clock: (iso: string | null | undefined) => string,
) {
  const legs = [...trip.legs].sort((a, b) => a.seqNo - b.seqNo);
  if (!legs.length) return { active: 0, stops: [] };
  const single = legs.length === 1;
  const rests =
    single && map
      ? map.stops
          .slice(1, -1)
          .filter((s) => s.locationType === "REST_STOP" || s.locationType === "BORDER")
      : [];
  const checkins = single ? legs[0].waypointCheckins : [];
  const checkinAt = (id: string) =>
    checkins.find((c) => c.waypointId === id)?.occurredAt;
  const stops = [
    {
      name: legs[0].fromLocationName,
      note: "Điểm xuất phát",
      time:
        legs[0].status === "NOT_STARTED"
          ? `Dự kiến ${clock(legs[0].plannedDepartureAt)}`
          : `Rời ${clock(legs[0].actualDepartureAt)}`,
    },
    ...rests.map((r) => {
      const at = checkinAt(r.locationId);
      return {
        // Dòng phụ đã ghi "Đã qua cửa khẩu", tên không lặp lại đuôi đó.
        name: r.name.replace(/\s*–\s*đã qua cửa khẩu$/, ""),
        note:
          r.locationType !== "BORDER"
            ? "Điểm nghỉ"
            : /đã qua cửa khẩu$/.test(r.name)
              ? "Đã qua cửa khẩu"
              : "Đến cửa khẩu · kiểm tra giấy tờ",
        time: at ? `Đến ${clock(at)}` : "Chưa đến",
      };
    }),
    ...legs.map((l, i) => ({
      name: l.toLocationName,
      note:
        i === legs.length - 1
          ? "Điểm giao"
          : l.status === "AT_STOP"
            ? "Đang dừng"
            : "Điểm dừng",
      time:
        l.status === "COMPLETED" || l.status === "AT_STOP"
          ? `Đến ${clock(l.actualArrivalAt)}`
          : `Dự kiến ${clock(l.plannedArrivalAt)}`,
    })),
  ];
  const current = legs.findIndex((l) => l.status !== "COMPLETED");
  const reached = rests.filter((r) => checkinAt(r.locationId)).length;
  const active =
    trip.orderStatus === "DELIVERED"
      ? stops.length
      : current < 0
        ? stops.length - 1
        : legs[current].status === "NOT_STARTED"
          ? current
          : current +
            1 +
            (legs[current].status === "MOVING" ? reached : rests.length);
  return { active, stops };
}

/**
 * Tên địa điểm cho thẻ, bỏ tên địa phương sau dấu "·":
 * "43, Manorom · มโนรมย์, Chai Nat · ชัยนาท" thành "43, Manorom, Chai Nat".
 */
export function placeName(name: string) {
  const short = name
    .split(",")
    .map((part) => part.split("·")[0].trim())
    .filter(Boolean)
    .join(", ");
  return short || name;
}

type CareActivity = {
  activityType: string;
  feedDescription: string | null;
  amountLiters: number | null;
  durationMinutes: number | null;
  note: string | null;
};
/** Dòng chi tiết của một lần chăm sóc, giống `activityDetail` của web. */
export function careDetail(activity: CareActivity) {
  const main =
    activity.activityType === "FEED"
      ? activity.feedDescription
      : activity.activityType === "WATER"
        ? activity.amountLiters === null
          ? null
          : `${activity.amountLiters.toLocaleString("vi-VN")} L`
        : activity.durationMinutes === null
          ? null
          : `${activity.durationMinutes} phút`;
  return [main, activity.note].filter(Boolean).join(" · ");
}
/** Tóm tắt nhật ký chăm sóc, giống web. */
export function careSummaryLine(summary: {
  meals: number;
  waterLiters: number;
  rests: number;
  restMinutes: number;
}) {
  return `${summary.meals} bữa ăn · ${summary.waterLiters.toLocaleString("vi-VN")} L nước · ${summary.rests} lần nghỉ chân${summary.restMinutes ? ` (${summary.restMinutes} phút)` : ""}`;
}

/** Tên ngắn cho nút: bỏ phần sau dấu phẩy và tiền tố loại điểm. */
export function shortName(name: string) {
  return name
    .split(",")[0]
    .replace(/^(Điểm nghỉ|Trạm dừng|Cửa khẩu quốc tế|Trang trại)\s+/i, "")
    .trim();
}

type PendingMilestone = {
  kind: string;
  status: string;
  /** Máy chủ đã nhận mục này. */
  sent?: boolean;
  legId?: string;
  milestoneType?: string;
  waypointId?: string;
  body: Record<string, unknown>;
};

/**
 * Áp các mốc còn trong hàng chờ lên chuyến để màn hình chuyển ngay sang việc kế tiếp,
 * kể cả khi chưa gửi được (mất sóng hoặc đang trong 5 giây Hoàn tác).
 * Mốc vừa gửi xong cũng đi qua đây, nên mốc máy chủ đã có thì bỏ qua để không lùi trạng thái.
 */
export function applyPending(
  trip: IDriverTripDetail,
  pending: PendingMilestone[],
): IDriverTripDetail {
  const legs = trip.legs.map((l) => ({
    ...l,
    milestones: [...l.milestones],
    waypointCheckins: [...l.waypointCheckins],
  }));
  for (const item of pending) {
    if (item.status === "REJECTED" || !item.legId) continue;
    // Giao ngựa có thể bị từ chối vì chưa trả đủ: chỉ coi là đã giao khi máy chủ đã nhận.
    if (item.milestoneType === "DELIVERED" && !item.sent) continue;
    const leg = legs.find((l) => l.id === item.legId);
    if (!leg) continue;
    const at = String(item.body.occurredAt ?? new Date().toISOString());
    if (item.kind === "checkin" && item.waypointId) {
      if (!leg.waypointCheckins.some((c) => c.waypointId === item.waypointId))
        leg.waypointCheckins.push({
          waypointId: item.waypointId,
          label: "",
          occurredAt: at,
          recordedByName: "",
        } as (typeof leg.waypointCheckins)[number]);
    } else if (item.kind === "complete") {
      leg.status = "COMPLETED" as typeof leg.status;
    } else if (item.kind === "milestone" && item.milestoneType) {
      if (leg.milestones.some((m) => m.milestoneType === item.milestoneType))
        continue;
      leg.milestones.push({
        id: `pending-${leg.milestones.length}`,
        milestoneType: item.milestoneType,
        occurredAt: at,
        recordedByName: "",
      } as unknown as (typeof leg.milestones)[number]);
      if (item.milestoneType === "DEPARTED")
        leg.status = "MOVING" as typeof leg.status;
      if (item.milestoneType === "ARRIVED_AT_STOP")
        leg.status = "AT_STOP" as typeof leg.status;
      if (item.milestoneType === "DELIVERED")
        leg.status = "COMPLETED" as typeof leg.status;
    }
  }
  const delivered =
    legs.length > 0 && legs.every((l) => l.status === "COMPLETED");
  return {
    ...trip,
    legs,
    orderStatus: delivered
      ? ("DELIVERED" as typeof trip.orderStatus)
      : legs.some((l) => l.status !== "NOT_STARTED")
        ? ("IN_TRANSIT" as typeof trip.orderStatus)
        : trip.orderStatus,
  };
}

/** Điểm kế tiếp và giờ dự kiến cho thẻ đầu màn tài xế (DRV-02). */
export function nextStop(trip: IDriverTripDetail, map?: ITripMap | null) {
  const legs = [...trip.legs].sort((a, b) => a.seqNo - b.seqNo);
  const leg =
    legs.find((l) => l.status === "MOVING" || l.status === "AT_STOP") ??
    legs.find((l) => l.status !== "COMPLETED");
  if (!leg) return null;
  if (leg.status === "NOT_STARTED")
    return {
      caption: "ĐIỂM XUẤT PHÁT",
      name: leg.fromLocationName,
      at: leg.plannedDepartureAt,
      atLabel: "Kế hoạch xuất phát",
    };
  if (leg.status === "AT_STOP")
    return {
      caption: "ĐANG DỪNG TẠI",
      name: leg.toLocationName,
      // Giờ rời là giờ xuất phát của chặng kế tiếp; chặng cuối không còn gì để rời.
      at: legs.find((l) => l.seqNo > leg.seqNo)?.plannedDepartureAt ?? null,
      atLabel: "Kế hoạch rời",
    };
  const rest =
    legs.length === 1 && map ? nextRestStop(map, leg.waypointCheckins) : null;
  return {
    caption: "ĐIỂM KẾ TIẾP",
    // Phía bên kia cửa khẩu: bỏ đuôi "– đã qua cửa khẩu", nút bên dưới đã nói rõ việc cần ghi.
    name: rest ? rest.name.replace(/\s*–\s*đã qua cửa khẩu$/, "") : leg.toLocationName,
    at: rest ? null : leg.plannedArrivalAt,
    atLabel: "Dự kiến đến",
  };
}
