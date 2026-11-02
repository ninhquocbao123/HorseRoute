import { CareActivityType, HorseAppetite, HorseConditionStatus } from '../enums/tracking.enum';

/**
 * Tình trạng ngựa của báo cáo sức khỏe (horse_logs.condition_status): đúng 4 trạng thái FR.
 * `attention` = cần điều phối chủ động liên hệ khách (Bỏ ăn / Căng thẳng / Khí hậu thay đổi); các trạng thái này
 * cũng bắt buộc có ảnh khi gửi báo cáo.
 */
export const HORSE_CONDITION_META: Record<HorseConditionStatus, { label: string; hint: string; attention: boolean }> = {
  [HorseConditionStatus.STABLE]: { label: 'Sức khỏe ổn định', hint: 'Bình thường', attention: false },
  [HorseConditionStatus.OFF_FEED]: { label: 'Bỏ ăn', hint: 'Không ăn/uống', attention: true },
  [HorseConditionStatus.STRESSED]: { label: 'Căng thẳng', hint: 'Bồn chồn, vã mồ hôi', attention: true },
  [HorseConditionStatus.CLIMATE_CHANGE]: { label: 'Khí hậu thay đổi', hint: 'Ảnh hưởng nhiệt độ/khí hậu', attention: true },
};

/** horse_logs.appetite */
export const HORSE_APPETITE_LABEL: Record<HorseAppetite, string> = {
  [HorseAppetite.NORMAL]: 'Bình thường',
  [HorseAppetite.REDUCED]: 'Giảm',
  [HorseAppetite.REFUSED]: 'Bỏ ăn',
};

/** horse_care_activities.activity_type */
export const CARE_ACTIVITY_LABEL: Record<CareActivityType, string> = {
  [CareActivityType.FEED]: 'Cho ăn',
  [CareActivityType.WATER]: 'Uống nước',
  [CareActivityType.REST]: 'Nghỉ chân',
};

/** Khoảng hợp lệ của số đo trong báo cáo (khớp CHECK ở DB). */
export const HORSE_VITALS_RANGE = {
  bodyTempC: { min: 30, max: 45 },
  heartRateBpm: { min: 10, max: 200 },
} as const;

/** Trạng thái bắt buộc có ≥ 1 ảnh khi gửi báo cáo (nháp được thiếu ảnh). */
export const HORSE_REPORT_PHOTO_REQUIRED_STATUSES: HorseConditionStatus[] = (Object.keys(HORSE_CONDITION_META) as HorseConditionStatus[])
  .filter(status => HORSE_CONDITION_META[status].attention);

/** Số ảnh tối đa của một báo cáo sức khỏe. */
export const HORSE_REPORT_MAX_PHOTOS = 3;

/**
 * Cờ bắt buộc ảnh (API kiểm tra, web hiện nhãn và chặn gửi):
 * - CARE_ACTIVITY: ảnh cập nhật cho khách khi ghi nhật ký cho ăn / uống nước / nghỉ chân.
 * - INCIDENT: ảnh hiện trường khi báo sự cố, để điều phối viên xem và xử lý.
 */
export const PHOTO_REQUIRED = { CARE_ACTIVITY: false, INCIDENT: true } as const;
