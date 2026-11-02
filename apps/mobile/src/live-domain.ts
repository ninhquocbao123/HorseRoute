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
  REDUCED: "Giảm",
  REFUSED: "Bỏ ăn",
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
): OrderPayload {
  if (!selected.length) throw new Error("Chọn ít nhất một ngựa.");
  const horses = selected.map((id) => {
    const horse = profiles.find((item) => String(item.id) === id);
    if (!horse || horse.activeOrderId)
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
  const result = (
    title: string,
    type: string,
    needsChecklist = false,
  ): DriverAction => ({
    label: title,
    path: `${base}/milestones`,
    body: { milestoneType: type },
    legId: leg.id,
    needsChecklist,
  });
  if (leg.status === "NOT_STARTED") {
    const previous = legs.find((l) => l.seqNo === leg.seqNo - 1);
    if (
      (previous && previous.status !== "COMPLETED") ||
      (leg.seqNo === 1 && trip.orderStatus !== "READY")
    )
      return null;
    return result("Xác nhận xuất phát", "DEPARTED", true);
  }
  if (leg.status === "MOVING") {
    // A single representative leg uses ordered route-plan waypoint IDs from the map API.
    // Do not guess IDs or offer arrival if the map failed to load.
    if (legs.length === 1) {
      if (!map) return null;
      const next = map.stops
        .slice(1, -1)
        .filter((stop) => stop.locationType === "REST_STOP")
        .find(
          (stop) =>
            !leg.waypointCheckins.some(
              (check) => check.waypointId === stop.locationId,
            ),
        );
      if (next)
        return {
          label: `Đã đến ${next.name}`,
          path: `${base}/waypoints/${asId(next.locationId)}/checkin`,
          body: {},
          legId: leg.id,
          needsChecklist: false,
        };
    }
    return result(`Đã đến ${leg.toLocationName}`, "ARRIVED_AT_STOP");
  }
  if (leg.status === "AT_STOP") {
    if (
      leg.toLocationType === "BORDER" &&
      !leg.milestones.some((m) => m.milestoneType === "CUSTOMS_CLEARED")
    )
      return result("Xác nhận đã thông quan", "CUSTOMS_CLEARED");
    if (leg.id === legs[legs.length - 1].id)
      return result("Xác nhận đã giao ngựa", "DELIVERED");
    return {
      label: "Hoàn thành chặng",
      path: `${base}/complete`,
      body: {},
      legId: leg.id,
      needsChecklist: false,
    };
  }
  return null;
}
