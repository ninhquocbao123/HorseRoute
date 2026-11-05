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
  RED: "Nghiêm trọng",
  ORANGE: "Trung bình",
  YELLOW: "Nhẹ",
  DEPARTED: "Xuất phát",
  ARRIVED_AT_STOP: "Đã đến điểm dừng",
  CUSTOMS_CLEARED: "Đã thông quan",
};
export const label = (value: string | null | undefined) =>
  value ? (statuses[value] ?? value) : "Chưa cập nhật";
export const dateTime = (value: string | null | undefined) =>
  value && Number.isFinite(Date.parse(value))
    ? new Date(value).toLocaleString("vi-VN")
    : "Chưa cập nhật";
export const money = (value: string | number | null | undefined) =>
  value !== null && value !== undefined && Number.isFinite(Number(value))
    ? `${Number(value).toLocaleString("vi-VN")} ₫`
    : "Chưa có báo giá";
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
export const canResumeDraft = (status: string) =>
  ["DRAFT", "NEED_INFO"].includes(status);
/** Máy chủ từ chối báo cáo gửi khách mà không có ghi chú gửi khách. */
export const customerNoteError = (sendToCustomer: boolean, note: string) =>
  sendToCustomer && !note.trim()
    ? "Nhập ghi chú gửi khách, hoặc tắt Gửi cho khách xem."
    : null;
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
          label: `Đã đến ${shortName(next.name)}`,
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
    .filter((stop) => stop.locationType === "REST_STOP")
    .find((stop) => !checkins.some((c) => c.waypointId === stop.locationId));
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
      at: leg.plannedDepartureAt,
      atLabel: "Kế hoạch rời",
    };
  const rest =
    legs.length === 1 && map ? nextRestStop(map, leg.waypointCheckins) : null;
  return {
    caption: "ĐIỂM KẾ TIẾP",
    name: rest ? rest.name : leg.toLocationName,
    at: rest ? null : leg.plannedArrivalAt,
    atLabel: "Dự kiến đến",
  };
}
