import { IncidentType } from '../enums/tracking.enum';

/**
 * Loại con của từng loại sự cố (incidents.sub_type lưu `code`).
 * Danh sách nằm ở đây thay vì enum trong DB để thêm loại con không cần migration.
 */
export const INCIDENT_SUB_TYPES: Record<IncidentType, { code: string; label: string }[]> = {
  [IncidentType.VEHICLE_BREAKDOWN]: [
    { code: 'TIRE_BURST', label: 'Nổ lốp' },
    { code: 'ENGINE_FAILURE', label: 'Hỏng máy' },
    { code: 'OUT_OF_FUEL', label: 'Hết nhiên liệu' },
    { code: 'OTHER', label: 'Khác' },
  ],
  [IncidentType.LONG_TRAFFIC_JAM]: [
    { code: 'ACCIDENT_AHEAD', label: 'Tai nạn phía trước' },
    { code: 'ROAD_WORKS', label: 'Thi công / cấm đường' },
    { code: 'RUSH_HOUR', label: 'Ùn tắc giờ cao điểm' },
    { code: 'OTHER', label: 'Khác' },
  ],
  [IncidentType.HORSE_MEDICAL]: [
    { code: 'INJURY', label: 'Chấn thương' },
    { code: 'OFF_FEED_DEHYDRATION', label: 'Bỏ ăn / mất nước' },
    { code: 'COLIC', label: 'Đau bụng (colic)' },
    { code: 'OTHER', label: 'Khác' },
  ],
};

/** `code` có thuộc danh sách loại con của `type` không. */
export function isValidSubType(type: IncidentType, code: string): boolean {
  return INCIDENT_SUB_TYPES[type]?.some(item => item.code === code) ?? false;
}
