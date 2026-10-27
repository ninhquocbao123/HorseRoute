import { CARE_ACTIVITY_LABEL, CareActivityType, type ICareActivity, type ICareActivityCreateInput, type IHorseLog, type ITripHorse } from '@my-project/shared';
import { fromLocalInput } from '../tracking.format';

/**
 * "Tất cả ngựa": giá trị của ô chọn ngựa. FEED/WATER ghi từng con; nghỉ chân là MỘT bản ghi cả đoàn (`horseId: null`).
 */
export const WHOLE_HERD = 'ALL';

export const CARE_TYPES: CareActivityType[] = [CareActivityType.FEED, CareActivityType.WATER, CareActivityType.REST];
export const careLabel = (type: CareActivityType) => CARE_ACTIVITY_LABEL[type];

const hhmm = new Intl.DateTimeFormat('vi-VN', { hour: '2-digit', minute: '2-digit', hour12: false });
const dayMonth = new Intl.DateTimeFormat('vi-VN', { day: '2-digit', month: '2-digit' });
export const clock = (iso: string) => hhmm.format(new Date(iso));
export const clockWithDay = (iso: string) => `${dayMonth.format(new Date(iso))} ${hhmm.format(new Date(iso))}`;

/** [đầu ngày địa phương, đầu ngày kế) cho khoảng "Hôm nay" của API (tối đa 7 ngày). */
export function todayRange(now = Date.now()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  return { from: start.toISOString(), to: new Date(start.getTime() + 24 * 3_600_000).toISOString() };
}

/** Tuổi (năm) từ ngày sinh yyyy-MM-dd; null khi thiếu hoặc không hợp lệ. */
export function ageYears(birthDate: string | null, now = Date.now()) {
  if (!birthDate) return null;
  const born = new Date(birthDate);
  if (Number.isNaN(born.getTime())) return null;
  const current = new Date(now);
  let age = current.getFullYear() - born.getFullYear();
  if (current.getMonth() < born.getMonth() || (current.getMonth() === born.getMonth() && current.getDate() < born.getDate())) age -= 1;
  return age >= 0 ? age : null;
}

/** "Thoroughbred · 5 tuổi"; bỏ phần thiếu dữ liệu. */
export const horseSubtitle = (horse: ITripHorse, now = Date.now()) => {
  const age = ageYears(horse.birthDate, now);
  return [horse.breed, age === null ? null : `${age} tuổi`].filter(Boolean).join(' · ') || horse.passportNo;
};

/** Báo cáo sức khỏe ĐÃ GỬI mới nhất của từng ngựa (nháp và nhật ký cũ không tính). */
export function latestReportByHorse(logs: IHorseLog[]) {
  const latest: Record<string, IHorseLog> = {};
  for (const log of logs) {
    if (log.reportStatus !== 'SENT') continue;
    const current = latest[log.horseId];
    if (!current || Date.parse(log.loggedAt) > Date.parse(current.loggedAt)) latest[log.horseId] = log;
  }
  return latest;
}

const liters = new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 1 });
export const formatLiters = (value: number) => `${liters.format(value)} L`;

/** Dòng chi tiết của một hoạt động: khẩu phần / lượng nước / số phút, kèm ghi chú. */
export function activityDetail(activity: ICareActivity) {
  const main = activity.activityType === CareActivityType.FEED ? activity.feedDescription
    : activity.activityType === CareActivityType.WATER ? (activity.amountLiters === null ? null : formatLiters(activity.amountLiters))
    : activity.durationMinutes === null ? null : `${activity.durationMinutes} phút`;
  return [main, activity.note].filter(Boolean).join(' · ');
}

/** Hoạt động trong khoảng [from, to) theo giờ thực hiện. */
export const inRange = (activity: ICareActivity, range: { from: string; to: string }) =>
  Date.parse(activity.performedAt) >= Date.parse(range.from) && Date.parse(activity.performedAt) < Date.parse(range.to);

export type CareForm = {
  horseId: string;
  activityType: CareActivityType;
  feedDescription: string;
  amountLiters: string;
  durationMinutes: string;
  note: string;
};

/** Trên ngưỡng này (lít, mỗi con) hiện cảnh báo vàng nhưng vẫn cho lưu; API chỉ chặn ngoài 0,1–200. */
export const WATER_WARN_LITERS = 60;

export const EMPTY_CARE_FORM: CareForm = { horseId: '', activityType: CareActivityType.FEED, feedDescription: '', amountLiters: '', durationMinutes: '', note: '' };

export function formFromActivity(activity: ICareActivity): CareForm {
  return {
    horseId: activity.horseId ?? WHOLE_HERD,
    activityType: activity.activityType,
    feedDescription: activity.feedDescription ?? '',
    amountLiters: activity.amountLiters === null ? '' : String(activity.amountLiters).replace('.', ','),
    durationMinutes: activity.durationMinutes === null ? '' : String(activity.durationMinutes),
    note: activity.note ?? '',
  };
}

const parseLiters = (text: string) => Number(text.trim().replace(',', '.'));

export type CareErrors = Partial<Record<'horseId' | 'feedDescription' | 'amountLiters' | 'durationMinutes' | 'note' | 'performedAt', string>>;

/** Kiểm tra khớp ràng buộc của API (FEED cần mô tả, WATER 0,1–200 L một chữ số thập phân, REST 1–720 phút, giờ không ở tương lai). */
export function validateCare(form: CareForm, performedAt: string, now = Date.now()): CareErrors {
  const errors: CareErrors = {};
  if (!form.horseId) errors.horseId = 'Chọn ngựa hoặc "Tất cả ngựa".';
  if (form.activityType === CareActivityType.FEED) {
    const text = form.feedDescription.trim();
    if (!text) errors.feedDescription = 'Nhập khẩu phần đã cho ăn.';
    else if (text.length > 200) errors.feedDescription = 'Khẩu phần tối đa 200 ký tự.';
  }
  if (form.activityType === CareActivityType.WATER) {
    const value = parseLiters(form.amountLiters);
    if (!form.amountLiters.trim() || !Number.isFinite(value)) errors.amountLiters = 'Nhập lượng nước (lít).';
    else if (value < 0.1 || value > 200) errors.amountLiters = 'Lượng nước phải từ 0,1 đến 200 lít.';
    else if (Math.abs(value * 10 - Math.round(value * 10)) > 1e-9) errors.amountLiters = 'Lượng nước chỉ có tối đa 1 chữ số thập phân.';
  }
  if (form.activityType === CareActivityType.REST) {
    const value = Number(form.durationMinutes.trim());
    if (!form.durationMinutes.trim() || !Number.isInteger(value)) errors.durationMinutes = 'Nhập số phút nghỉ (số nguyên).';
    else if (value < 1 || value > 720) errors.durationMinutes = 'Thời gian nghỉ phải từ 1 đến 720 phút.';
  }
  if (form.note.length > 255) errors.note = 'Ghi chú tối đa 255 ký tự.';
  const at = fromLocalInput(performedAt);
  if (!at) errors.performedAt = 'Giờ thực hiện không hợp lệ.';
  else if (at.getTime() > now + 60_000) errors.performedAt = 'Giờ thực hiện không được ở tương lai.';
  return errors;
}

/** Body gửi API cho một ngựa (`horseId` null = cả đoàn). */
export function toInput(form: CareForm, horseId: string | null, performedAt: Date, correctsActivityId?: string): ICareActivityCreateInput {
  const base = { activityType: form.activityType, horseId, performedAt: performedAt.toISOString(), note: form.note.trim() || null, ...(correctsActivityId ? { correctsActivityId } : {}) };
  if (form.activityType === CareActivityType.FEED) return { ...base, feedDescription: form.feedDescription.trim() };
  if (form.activityType === CareActivityType.WATER) return { ...base, amountLiters: parseLiters(form.amountLiters) };
  return { ...base, durationMinutes: Number(form.durationMinutes.trim()) };
}

/** Lượng nước nhập (lít) hợp lệ và lớn hơn ngưỡng cảnh báo. */
export function isUnusualWater(form: CareForm) {
  if (form.activityType !== CareActivityType.WATER) return false;
  const value = parseLiters(form.amountLiters);
  return Number.isFinite(value) && value > WATER_WARN_LITERS && value <= 200;
}

/** Ngày địa phương yyyy-MM-dd của một thời điểm ISO. */
export const localDay = (iso: string | number | Date) => {
  const d = new Date(iso);
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/**
 * Khoảng ngày chọn được của lịch sử hoạt động: từ ngày sớm nhất (giờ xuất phát hoặc hoạt động đầu tiên) tới ngày muộn nhất
 * (hôm nay nếu chuyến còn chạy, ngược lại giờ đến hoặc hoạt động cuối cùng). Mặc định hôm nay nếu nằm trong khoảng, không thì ngày cuối.
 */
export function historyDays(activities: ICareActivity[], tripStart: string | null, tripEnd: string | null, running: boolean, now = Date.now()) {
  const days = activities.map(activity => localDay(activity.performedAt));
  const first = [...days, ...(tripStart ? [localDay(tripStart)] : [])].sort()[0] ?? localDay(now);
  const lastCandidates = [...days, ...(running ? [localDay(now)] : tripEnd ? [localDay(tripEnd)] : [])].sort();
  const last = lastCandidates[lastCandidates.length - 1] ?? first;
  const today = localDay(now);
  const min = first <= last ? first : last;
  return { min, max: last, initial: today >= min && today <= last ? today : last };
}
