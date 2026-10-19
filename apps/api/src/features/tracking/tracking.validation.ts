import { z } from 'zod';
import { idSchema } from '../../shared/utils/validation.util';
import {
  LegStatus,
  MilestoneType,
  HorseConditionStatus,
  IncidentType,
  IncidentStatus,
  AlertType,
} from '@my-project/shared';

export const legIdSchema = idSchema.refine(
  id => id.length < 20 || (id.length === 20 && id <= '18446744073709551615'),
  'ID vượt giới hạn BIGINT UNSIGNED.'
);

// Milestone time must be ISO 8601 UTC ending in Z, up to seconds or .000Z
const milestoneTimeSchema = z.string().datetime({ offset: false }).refine(value => {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime());
}, 'Thời điểm phải có định dạng UTC ISO 8601 (kết thúc bằng Z).');

/** Mặc định T (phút) cho phép nhập bù mốc đã xảy ra; có thể ghi đè bằng system_parameters.LEG_BACK. */
export const DEFAULT_MAX_RETROACTIVE_MINUTES = 120;
const CLOCK_SKEW_MS = 60_000;

function checkOccurredAt(occurredAt: string, maxRetroactiveMinutes: number, context: z.RefinementCtx) {
  const timestamp = Date.parse(occurredAt);
  const now = Date.now();
  if (timestamp > now + CLOCK_SKEW_MS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['occurredAt'],
      message: 'Thời điểm xảy ra không được ở tương lai (BR-LEG-03).',
    });
  }
  if (now - timestamp > maxRetroactiveMinutes * 60 * 1000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['occurredAt'],
      message: `Đã vượt quá thời gian cho phép nhập bù (${maxRetroactiveMinutes} phút). Vui lòng báo Điều phối viên hiệu chỉnh (UC-14).`,
    });
  }
}

export function buildMilestoneSchema(maxRetroactiveMinutes = DEFAULT_MAX_RETROACTIVE_MINUTES) {
  return z.object({
    milestoneType: z.nativeEnum(MilestoneType, {
      errorMap: () => ({ message: 'Loại mốc không hợp lệ (DEPARTED, ARRIVED_AT_STOP, CUSTOMS_CLEARED, DELIVERED).' }),
    }),
    occurredAt: milestoneTimeSchema,
  }).strict().superRefine(({ occurredAt }, context) => checkOccurredAt(occurredAt, maxRetroactiveMinutes, context));
}
export const createMilestoneSchema = buildMilestoneSchema();
export type CreateMilestoneInput = z.infer<typeof createMilestoneSchema>;

export function buildCompleteLegSchema(maxRetroactiveMinutes = DEFAULT_MAX_RETROACTIVE_MINUTES) {
  return z.object({ occurredAt: milestoneTimeSchema }).strict()
    .superRefine(({ occurredAt }, context) => checkOccurredAt(occurredAt, maxRetroactiveMinutes, context));
}
export const completeLegSchema = buildCompleteLegSchema();
export type CompleteLegInput = z.infer<typeof completeLegSchema>;

export const correctLegSchema = z.object({
  status: z.nativeEnum(LegStatus, {
    errorMap: () => ({ message: 'Trạng thái chặng không hợp lệ (NOT_STARTED, MOVING, AT_STOP, COMPLETED).' }),
  }),
  reason: z.string().trim().min(1, 'Lý do hiệu chỉnh là bắt buộc.').max(255, 'Lý do tối đa 255 ký tự.'),
  // Giờ điền cho mốc/giờ thực tế còn thiếu; Điều phối viên không bị giới hạn cửa sổ T nhưng không được ở tương lai.
  occurredAt: milestoneTimeSchema.optional(),
}).strict().superRefine(({ occurredAt }, context) => {
  if (occurredAt && Date.parse(occurredAt) > Date.now() + CLOCK_SKEW_MS) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['occurredAt'], message: 'Thời điểm không được ở tương lai.' });
  }
});
export type CorrectLegInput = z.infer<typeof correctLegSchema>;

// Stage 2 schemas
export const createHorseLogSchema = z.object({
  horseId: legIdSchema,
  conditionStatus: z.nativeEnum(HorseConditionStatus, {
    errorMap: () => ({ message: 'Tình trạng ngựa không hợp lệ (STABLE, OFF_FEED, STRESSED, CLIMATE_CHANGE).' }),
  }),
  note: z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự.').optional().nullable(),
  loggedAt: milestoneTimeSchema,
  correctsLogId: legIdSchema.optional().nullable(),
}).strict().superRefine(({ loggedAt }, context) => {
  const timestamp = Date.parse(loggedAt);
  const now = Date.now();
  if (timestamp > now + 60000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['loggedAt'],
      message: 'Thời điểm ghi nhật ký không được ở tương lai.',
    });
  }
});
export type CreateHorseLogInput = z.infer<typeof createHorseLogSchema>;

export const createIncidentSchema = z.object({
  incidentType: z.nativeEnum(IncidentType, {
    errorMap: () => ({ message: 'Loại sự cố không hợp lệ (VEHICLE_BREAKDOWN, LONG_TRAFFIC_JAM, HORSE_MEDICAL).' }),
  }),
  description: z.string().trim().min(5, 'Mô tả sự cố tối thiểu 5 ký tự.').max(2000, 'Mô tả sự cố tối đa 2000 ký tự.'),
  legId: legIdSchema.optional().nullable(),
  horseId: legIdSchema.optional().nullable(),
}).strict().superRefine((data, context) => {
  if (data.incidentType === IncidentType.HORSE_MEDICAL && !data.horseId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['horseId'],
      message: 'Sự cố y tế ngựa (HORSE_MEDICAL) bắt buộc phải chọn con ngựa bị ảnh hưởng.',
    });
  }
});
export type CreateIncidentInput = z.infer<typeof createIncidentSchema>;

export const patchIncidentSchema = z.object({
  status: z.enum([IncidentStatus.ACKNOWLEDGED, IncidentStatus.CLOSED], {
    errorMap: () => ({ message: 'Trạng thái xử lý sự cố phải là ACKNOWLEDGED hoặc CLOSED.' }),
  }),
  handlingNote: z.string().trim().max(2000, 'Ghi chú xử lý tối đa 2000 ký tự.').optional().nullable(),
}).strict().superRefine((data, context) => {
  if (data.status === IncidentStatus.CLOSED && (!data.handlingNote || data.handlingNote.trim().length === 0)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['handlingNote'],
      message: 'Khi đóng sự cố (CLOSED), bắt buộc phải có ghi chú xử lý (handlingNote) theo quy định BR-INC-03.',
    });
  }
});
export type PatchIncidentInput = z.infer<typeof patchIncidentSchema>;

export const createAlertSchema = z.object({
  alertType: z.nativeEnum(AlertType, {
    errorMap: () => ({ message: 'Loại cảnh báo không hợp lệ (TRAFFIC, WEATHER, BORDER).' }),
  }),
  content: z.string().trim().min(5, 'Nội dung cảnh báo tối thiểu 5 ký tự.').max(500, 'Nội dung cảnh báo tối đa 500 ký tự.'),
}).strict();
export type CreateAlertInput = z.infer<typeof createAlertSchema>;

