import { z } from 'zod';
import { isCountryCode } from '@my-project/shared';
import { idSchema } from '../../shared/utils/validation.util';

export const locationIdSchema = idSchema.refine(id => id.length < 20 || (id.length === 20 && id <= '18446744073709551615'), 'ID vượt giới hạn BIGINT UNSIGNED.');
export const LOCATION_TYPES = ['BORDER', 'QUARANTINE_STATION', 'REST_STOP', 'AIRPORT', 'FUEL_STOP'] as const;

// Intl alone also accepts offsets ("+07:00") and any letter case, so require the IANA "Area/Location" shape first.
const IANA_NAME = /^(?:UTC|[A-Z][A-Za-z]+(?:\/[A-Z][A-Za-z0-9_+-]*){1,2})$/;
export function isIanaTimezone(value: string): boolean {
  if (!IANA_NAME.test(value)) return false;
  try { new Intl.DateTimeFormat('en-US', { timeZone: value }); return true; } catch { return false; }
}
const round6 = (value: number) => Math.round(value * 1e6) / 1e6;
const coordinate = (label: string, max: number) => z.number({ invalid_type_error: `${label} phải là số.`, required_error: `${label} là bắt buộc.` })
  .finite(`${label} phải là số.`).min(-max, `${label} phải trong khoảng ±${max}.`).max(max, `${label} phải trong khoảng ±${max}.`).transform(round6);

export const locationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  locationType: z.enum(LOCATION_TYPES).optional(),
  country: z.string().trim().toUpperCase().refine(isCountryCode, 'Mã quốc gia không hợp lệ.').optional(),
  coordinates: z.enum(['all', 'missing', 'present']).default('all'),
  q: z.string().trim().max(150).optional(),
}).strict().refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), { message: 'Trang vượt giới hạn phân trang.', path: ['page'] });

export const locationSchema = z.object({
  name: z.string({ required_error: 'Tên địa điểm là bắt buộc.' }).trim().min(1, 'Tên địa điểm là bắt buộc.').max(150, 'Tối đa 150 ký tự.'),
  locationType: z.enum(LOCATION_TYPES, { errorMap: () => ({ message: 'Loại địa điểm không hợp lệ.' }) }),
  country: z.string({ required_error: 'Quốc gia là bắt buộc.' }).trim().toUpperCase().refine(isCountryCode, 'Chọn quốc gia / vùng lãnh thổ hợp lệ.'),
  timezone: z.string({ required_error: 'Múi giờ là bắt buộc.' }).trim().max(50, 'Tối đa 50 ký tự.')
    .refine(isIanaTimezone, 'Múi giờ phải là tên IANA hợp lệ, ví dụ Asia/Ho_Chi_Minh.'),
  address: z.string().trim().max(255, 'Tối đa 255 ký tự.').nullish().transform(value => value || null),
  latitude: coordinate('Vĩ độ', 90),
  longitude: coordinate('Kinh độ', 180),
}).strict()
  // (0, 0) is open ocean: almost always an unset map pin, never a real stop.
  .refine(({ latitude, longitude }) => latitude !== 0 || longitude !== 0, { message: 'Hãy đặt ghim vị trí trên bản đồ.', path: ['latitude'] });
export type LocationInput = z.infer<typeof locationSchema>;
