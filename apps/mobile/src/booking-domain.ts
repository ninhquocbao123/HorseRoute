/**
 * Logic tạo đơn (CUS-11 đến CUS-14), khớp luồng web `apps/web/src/features/customer`.
 * Quản lý báo giá từ `booking`, nên mọi trường ở đây phải đi cùng định dạng với web.
 */
import type { OrderDetail, OrderHorse, Profile } from "./api/types";
import { orderPayload, validDate } from "./live-domain.ts";
import { estimateDurationDays } from "../../../packages/shared/src/types/pricing.type.ts";

export type BookingContact = {
  name: string;
  phone: string;
  address: string;
  city: string;
  ward: string;
  identityNumber: string;
  country: string;
};
export type VehicleClass = "LIGHT" | "MEDIUM" | "HEAVY";
export type Insurance =
  | "NONE"
  | "THOROUGHBRED"
  | "ARABIAN"
  | "QUARTER_HORSE"
  | "WARMBLOOD"
  | "APPALOOSA"
  | "OTHER";
export type BookingData = {
  sender: BookingContact;
  recipient: BookingContact;
  pickupTime: string;
  vehicleClass: VehicleClass;
  vehicleCapacity: 2 | 4 | 6 | 9;
  distanceKm: number;
  durationDays: number;
  insurance: Insurance;
  feed: "STANDARD" | "PREMIUM" | "SPORT";
  extraStall: boolean;
  water: "EVERY_2_HOURS" | "EVERY_HOUR";
  waterRounds: number;
  border: string;
  documentLanguage: string;
  customsCode: string;
  importPermit: string;
  paymentMethod: "BANK" | "WALLET" | "CARD";
  termsAccepted: boolean;
};
/** B13: cửa khẩu phía Việt Nam của các hành lang API tự lập lộ trình (apps/api/src/features/trips/border-gates.ts). */
const BORDER_GATES: Record<string, string[]> = {
  CN: ["Hữu Nghị", "Móng Cái", "Lào Cai", "Tà Lùng", "Thanh Thủy"],
  TH: ["Lao Bảo", "Cầu Treo", "Mộc Bài"],
};
/** Cửa khẩu chọn được cho chuyến quốc tế: theo nước không phải Việt Nam ở hai đầu. */
export function borderGates(sender: string, recipient: string) {
  return BORDER_GATES[recipient !== "VN" ? recipient : sender] ?? [];
}

/** B13: trạng thái đơn còn bổ sung được thông quan (khớp CUSTOMS_EDITABLE ở API). */
export const CUSTOMS_EDITABLE = ["PENDING", "APPROVED", "PREPARING", "READY", "IN_TRANSIT"];
export type CustomsValue = { customsCode: string; importPermit: string; border: string };
/** Thông quan lưu trong booking_details của đơn (chuỗi JSON hoặc object). */
export function customsOf(booking: unknown): CustomsValue {
  let data: Record<string, unknown> = {};
  try {
    data = (typeof booking === "string" ? JSON.parse(booking) : (booking ?? {})) as Record<string, unknown>;
  } catch {
    /* booking hỏng: coi như trống */
  }
  const text = (v: unknown) => (typeof v === "string" ? v : "");
  return { customsCode: text(data.customsCode), importPermit: text(data.importPermit), border: text(data.border) };
}

export type BookingDraft = {
  requestId: string;
  savedId?: string;
  step: number;
  date: string;
  notes: string;
  international: boolean;
  selected: string[];
  /** Đơn Cần bổ sung giữ nguyên danh sách ngựa. */
  lockedHorses?: OrderHorse[];
  booking: BookingData;
};
type Account = {
  fullName: string;
  phone?: string | null;
  address?: string | null;
};
export type BookingErrors = Record<string, string>;

export const BOOKING_STEPS = [
  "Chuyến đi",
  "Chọn ngựa",
  "Dịch vụ & bảo hiểm",
  "Xác nhận & gửi",
];
export const PICKUP_TIMES = [
  "06:00 – 08:00",
  "08:00 – 10:00",
  "10:00 – 12:00",
  "13:00 – 15:00",
  "15:00 – 17:00",
];
export const VEHICLES = [
  { capacity: 2, vehicleClass: "LIGHT", label: "Xe 2 ngựa" },
  { capacity: 4, vehicleClass: "MEDIUM", label: "Xe 4 ngựa" },
  { capacity: 6, vehicleClass: "MEDIUM", label: "Xe 6 ngựa" },
  { capacity: 9, vehicleClass: "HEAVY", label: "Xe 9 ngựa" },
] as const;
export const COUNTRY_NAMES: Record<string, string> = {
  VN: "Việt Nam",
  CN: "Trung Quốc",
  TH: "Thái Lan",
};
export const INSURANCE_GROUPS: [Exclude<Insurance, "NONE">, string][] = [
  ["THOROUGHBRED", "Thoroughbred"],
  ["ARABIAN", "Arabian"],
  ["QUARTER_HORSE", "Quarter Horse"],
  ["WARMBLOOD", "Warmblood"],
  ["APPALOOSA", "Appaloosa"],
  ["OTHER", "Khác"],
];

export const blankContact = (country = "VN"): BookingContact => ({
  name: "",
  phone: "",
  address: "",
  city: "",
  ward: "",
  identityNumber: "",
  country,
});
export const accountContact = (account: Account) => ({
  name: account.fullName,
  phone: account.phone ?? "",
  address: account.address ?? "",
});
export const contactAddress = (c: BookingContact) =>
  [c.address, c.ward, c.city]
    .map((part) => part.trim())
    .filter(Boolean)
    .join(", ");
/** Tìm không dấu: "ha noi" khớp "Hà Nội". */
export const normalizeSearch = (value: string) =>
  value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .trim();

const blankBooking = (account: Account): BookingData => ({
  // Người gửi để trống tới khi khách bấm "Tôi là người gửi" (khớp web).
  sender: blankContact(),
  recipient: blankContact(),
  pickupTime: "08:00 – 10:00",
  vehicleClass: "LIGHT",
  vehicleCapacity: 2,
  distanceKm: 0,
  durationDays: 1,
  insurance: "NONE",
  feed: "STANDARD",
  extraStall: false,
  water: "EVERY_2_HOURS",
  waterRounds: 0,
  border: "",
  documentLanguage: "",
  customsCode: "",
  importPermit: "",
  paymentMethod: "BANK",
  termsAccepted: false,
});

export function newDraft(
  requestId: string,
  account: Account,
  selected: string[] = [],
): BookingDraft {
  return withVehicleFor(selected.length, {
    requestId,
    step: 0,
    date: "",
    notes: "",
    international: false,
    selected,
    booking: blankBooking(account),
  });
}

/** Hạng xe nhỏ nhất đủ chỗ. Xe đang chọn còn đủ chỗ thì giữ nguyên. */
export function withVehicleFor(
  count: number,
  draft: BookingDraft,
): BookingDraft {
  if (count <= draft.booking.vehicleCapacity) return draft;
  const fit = VEHICLES.find((v) => v.capacity >= count);
  return fit
    ? {
        ...draft,
        booking: {
          ...draft.booking,
          vehicleClass: fit.vehicleClass,
          vehicleCapacity: fit.capacity,
        },
      }
    : draft;
}

const clearPlace = (c: BookingContact, country: string): BookingContact =>
  c.country === country ? c : { ...c, country, city: "", ward: "" };

/** Trong nước: VN → VN. Quốc tế: mặc định VN → CN. */
export function setTripType(
  draft: BookingDraft,
  international: boolean,
): BookingDraft {
  if (draft.international === international) return draft;
  return {
    ...draft,
    international,
    booking: {
      ...draft.booking,
      sender: clearPlace(draft.booking.sender, "VN"),
      recipient: clearPlace(
        draft.booking.recipient,
        international ? "CN" : "VN",
      ),
    },
  };
}
/** Chỉ nhận tuyến VN với CN hoặc TH, giống web. */
export function setRoute(
  draft: BookingDraft,
  from: string,
  to: string,
): BookingDraft {
  const allowed =
    (from === "VN" && ["CN", "TH"].includes(to)) ||
    (to === "VN" && ["CN", "TH"].includes(from));
  if (!allowed) return draft;
  return {
    ...draft,
    booking: {
      ...draft.booking,
      sender: clearPlace(draft.booking.sender, from),
      recipient: clearPlace(draft.booking.recipient, to),
    },
  };
}

/** Nhóm bảo hiểm mặc định: cả đoàn cùng giống thì theo giống, còn lại là Khác. */
export function insuranceForBreeds(breeds: string[]): Insurance {
  const codes = breeds.map((b) => b.toUpperCase().replace(/\s+/g, "_"));
  return (
    INSURANCE_GROUPS.find(
      ([code]) => codes.length > 0 && codes.every((c) => c === code),
    )?.[0] ?? "OTHER"
  );
}

const contactErrors = (
  key: "sender" | "recipient",
  c: BookingContact,
): BookingErrors => {
  const e: BookingErrors = {};
  const phone = c.phone.replace(/[\s.]/g, "");
  if (!c.name.trim()) e[`${key}.name`] = "Nhập họ tên hoặc tên đơn vị.";
  if (!/^\+?\d{9,15}$/.test(phone))
    e[`${key}.phone`] = "Số điện thoại cần 9 đến 15 chữ số.";
  if (!c.city) e[`${key}.city`] = "Chọn tỉnh hoặc thành phố.";
  if (!c.ward) e[`${key}.ward`] = "Chọn xã, phường hoặc khu vực.";
  if (!c.address.trim())
    e[`${key}.address`] = "Nhập tên trang trại hoặc địa chỉ cụ thể.";
  if (!c.identityNumber.trim())
    e[`${key}.identityNumber`] = "Nhập số CCCD, MST hoặc hộ chiếu.";
  return e;
};

/** Lỗi của một bước, khóa theo tên ô. `today` dạng YYYY-MM-DD theo giờ máy. */
export function stepErrors(
  step: number,
  draft: BookingDraft,
  today: string,
): BookingErrors {
  const b = draft.booking;
  const count = draft.lockedHorses?.length ?? draft.selected.length;
  if (step === 0) {
    const e: BookingErrors = {};
    if (!validDate(draft.date) || draft.date < today)
      e.date = "Chọn ngày khởi hành từ hôm nay trở đi.";
    if (draft.international && b.sender.country === b.recipient.country)
      e.route = "Chọn hai quốc gia khác nhau cho chuyến quốc tế.";
    Object.assign(
      e,
      contactErrors("sender", b.sender),
      contactErrors("recipient", b.recipient),
    );
    return e;
  }
  if (step === 1) {
    const e: BookingErrors = {};
    if (!count) e.horses = "Chọn ít nhất 1 ngựa để tiếp tục.";
    if (count > 9) e.horses = "Mỗi đơn tối đa 9 ngựa.";
    else if (count > b.vehicleCapacity)
      e.vehicle = "Số ngựa vượt sức chứa của hạng xe.";
    return e;
  }
  if (step === 2) {
    const rounds = b.waterRounds;
    if (
      rounds !== 0 &&
      (!Number.isInteger(rounds) || rounds < 1 || rounds > 1000)
    )
      return { waterRounds: "Số cữ nước từ 1 đến 1000." };
    return {};
  }
  return b.termsAccepted
    ? {}
    : { terms: "Đánh dấu đồng ý điều khoản vận chuyển để gửi." };
}

export function estimateInput(
  draft: BookingDraft,
  horseCount: number,
  distanceKm: number,
) {
  const b = draft.booking;
  return {
    distanceKm,
    durationDays: estimateDurationDays(distanceKm),
    vehicleClass: b.vehicleClass,
    vehicleCapacity: b.vehicleCapacity,
    horseCount: Math.max(1, horseCount),
    insurance: b.insurance,
    feed: b.feed,
    extraStall: b.extraStall,
    water: b.water,
    waterRounds: b.waterRounds,
    international: draft.international,
  };
}

/**
 * Thân gửi lên `/orders`. Nháp chưa có quãng đường thì chưa gửi `booking`
 * vì máy chủ yêu cầu `distanceKm` từ 1 trở lên; phần đó vẫn nằm trong nháp trên máy.
 */
export function orderBody(draft: BookingDraft, profiles: Profile[]) {
  const b = draft.booking;
  const base = {
    originAddress: contactAddress(b.sender),
    originCountry: b.sender.country,
    destinationAddress: contactAddress(b.recipient),
    destinationCountry: b.recipient.country,
    desiredDepartureDate: draft.date,
    specialRequirements: draft.notes,
  };
  const payload = draft.lockedHorses
    ? { ...base, horses: draft.lockedHorses }
    : orderPayload(base, draft.selected, profiles, draft.savedId);
  const clean = (c: BookingContact) => ({
    ...c,
    phone: c.phone.replace(/[\s.]/g, ""),
  });
  return b.distanceKm >= 1
    ? {
        ...payload,
        booking: {
          ...b,
          sender: clean(b.sender),
          recipient: clean(b.recipient),
          durationDays: estimateDurationDays(b.distanceKm),
        },
      }
    : payload;
}

const parseBooking = (value: unknown): Partial<BookingData> | null => {
  if (!value) return null;
  if (typeof value === "object") return value as Partial<BookingData>;
  try {
    return JSON.parse(String(value));
  } catch {
    return null;
  }
};

/** Mở lại đơn nháp hoặc đơn Cần bổ sung, kể cả đơn tạo từ web. */
export function draftFromOrder(
  order: OrderDetail,
  account: Account,
  requestId: string,
  horses: OrderHorse[],
): BookingDraft {
  const saved =
    parseBooking(order.draft?.booking) ?? parseBooking(order.booking_details);
  const blank = blankBooking(account);
  const booking: BookingData = {
    ...blank,
    ...saved,
    sender: { ...blank.sender, ...saved?.sender },
    recipient: { ...blank.recipient, ...saved?.recipient },
  };
  const international = booking.sender.country !== booking.recipient.country;
  const editableHorses = order.status === "DRAFT";
  return {
    requestId,
    savedId: String(order.id),
    step: 0,
    date: (
      order.draft?.desiredDepartureDate ??
      order.desired_departure_date ??
      ""
    ).slice(0, 10),
    notes: order.draft?.specialRequirements ?? order.special_requirements ?? "",
    international,
    selected: horses.map((h) => h.profileId).filter((id): id is string => !!id),
    lockedHorses: editableHorses ? undefined : horses,
    booking,
  };
}

type OldDraft = {
  requestId?: string;
  savedId?: string;
  selected?: string[];
  recipientName?: string;
  recipientPhone?: string;
  payload?: { desiredDepartureDate?: string; specialRequirements?: string };
};
/** Nháp bản cũ gõ địa chỉ tự do: giữ ngựa, ngày, ghi chú, người nhận; địa chỉ phải nhập lại. */
export function migrateOldDraft(
  old: OldDraft,
  account: Account,
  requestId: string,
): BookingDraft {
  const draft = newDraft(
    old.requestId || requestId,
    account,
    Array.isArray(old.selected) ? old.selected : [],
  );
  return {
    ...draft,
    savedId: old.savedId,
    date: old.payload?.desiredDepartureDate ?? "",
    notes: old.payload?.specialRequirements ?? "",
    booking: {
      ...draft.booking,
      recipient: {
        ...draft.booking.recipient,
        name: old.recipientName ?? "",
        phone: old.recipientPhone ?? "",
      },
    },
  };
}
