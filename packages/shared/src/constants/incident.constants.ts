import { IncidentSeverity, IncidentType } from '../enums/tracking.enum';

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

/**
 * Mức độ sự cố: tên hiển thị (không nêu tên màu) + bảng màu dùng chung cho mọi giao diện.
 * `color` = màu chính (viền, dấu tích), `soft` = nền nhạt, `text` = chữ đủ tương phản trên nền nhạt.
 * Thứ tự khóa = thứ tự hiển thị (nặng → nhẹ). RED luôn suy ra urgency HIGH ở backend.
 */
export const INCIDENT_SEVERITY_META: Record<IncidentSeverity, { label: string; hint: string; color: string; soft: string; text: string }> = {
  [IncidentSeverity.RED]: { label: 'Nghiêm trọng', hint: 'Tai nạn, ngựa bị thương, xe không chạy được', color: '#dc2626', soft: '#fee2e2', text: '#b91c1c' },
  [IncidentSeverity.ORANGE]: { label: 'Trung bình', hint: 'Hỏng nhẹ, ngựa có dấu hiệu lạ', color: '#ea580c', soft: '#ffedd5', text: '#c2410c' },
  [IncidentSeverity.YELLOW]: { label: 'Nhẹ', hint: 'Kẹt xe, trễ lịch, thời tiết xấu', color: '#ca8a04', soft: '#fef9c3', text: '#854d0e' },
};
