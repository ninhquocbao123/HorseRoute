import { z } from 'zod';
import { idSchema } from '../../shared/utils/validation.util';
import {
  LegStatus,
  MilestoneType,
  HorseConditionStatus,
  IncidentType,
  IncidentStatus,
  IncidentSeverity,
  DamageTarget,
  AlertType,
  CareActivityType,
  HorseAppetite,
  HorseReportStatus,
  HORSE_VITALS_RANGE,
  HORSE_REPORT_MAX_PHOTOS,
  isValidSubType,
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

function checkOccurredAt(occurredAt: string, maxRetroactiveMinutes: number, context: z.RefinementCtx, field = 'occurredAt') {
  const timestamp = Date.parse(occurredAt);
  const now = Date.now();
  if (timestamp > now + CLOCK_SKEW_MS) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
      message: 'Thời điểm xảy ra không được ở tương lai (BR-LEG-03).',
    });
  }
  if (now - timestamp > maxRetroactiveMinutes * 60 * 1000) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [field],
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
/** Multipart gửi cờ là chuỗi 'true'/'false'; JSON gửi boolean. */
const formBoolean = z.preprocess(
  value => (value === 'true' ? true : value === 'false' ? false : value),
  z.boolean({ invalid_type_error: 'Giá trị phải là true hoặc false.' }),
);
/** Một nhãn là chuỗi, nhiều nhãn là mảng (field lặp lại); tối đa bằng số ảnh cho phép. */
const formList = (item: z.ZodTypeAny, max: number, message: string) => z.preprocess(
  value => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]),
  z.array(item).max(max, message),
);
const noFuture = (loggedAt: string, context: z.RefinementCtx) => {
  if (Date.parse(loggedAt) > Date.now() + 60000) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['loggedAt'], message: 'Thời điểm ghi nhật ký không được ở tương lai.' });
  }
};

const horseConditionSchema = z.nativeEnum(HorseConditionStatus, {
  errorMap: () => ({ message: 'Tình trạng ngựa không hợp lệ (STABLE, OFF_FEED, STRESSED, CLIMATE_CHANGE).' }),
});
/** Các trường nội dung báo cáo sức khỏe, dùng chung cho tạo và sửa nháp. */
const horseReportFields = {
  conditionStatus: horseConditionSchema,
  note: z.string().trim().max(1000, 'Ghi chú tối đa 1000 ký tự.').optional().nullable(),
  loggedAt: milestoneTimeSchema,
  customerNote: z.string().trim().max(1000, 'Ghi chú gửi khách tối đa 1000 ký tự.').optional().nullable(),
  bodyTempC: z.coerce.number({ invalid_type_error: 'Nhiệt độ phải là số.' })
    .refine(value => value >= HORSE_VITALS_RANGE.bodyTempC.min && value <= HORSE_VITALS_RANGE.bodyTempC.max,
      `Nhiệt độ cơ thể phải trong khoảng ${HORSE_VITALS_RANGE.bodyTempC.min}..${HORSE_VITALS_RANGE.bodyTempC.max} °C.`)
    .refine(value => Math.abs(value * 10 - Math.round(value * 10)) < 1e-9, 'Nhiệt độ chỉ có tối đa 1 chữ số thập phân.')
    .optional().nullable(),
  heartRateBpm: z.coerce.number({ invalid_type_error: 'Nhịp tim phải là số.' })
    .int('Nhịp tim phải là số nguyên.')
    .min(HORSE_VITALS_RANGE.heartRateBpm.min, `Nhịp tim phải trong khoảng ${HORSE_VITALS_RANGE.heartRateBpm.min}..${HORSE_VITALS_RANGE.heartRateBpm.max} lần/phút.`)
    .max(HORSE_VITALS_RANGE.heartRateBpm.max, `Nhịp tim phải trong khoảng ${HORSE_VITALS_RANGE.heartRateBpm.min}..${HORSE_VITALS_RANGE.heartRateBpm.max} lần/phút.`)
    .optional().nullable(),
  appetite: z.nativeEnum(HorseAppetite, { errorMap: () => ({ message: 'Ăn uống không hợp lệ (NORMAL, REDUCED, REFUSED).' }) }).optional().nullable(),
  sendToCustomer: formBoolean.optional(),
  captions: formList(z.string().trim().max(100, 'Nhãn ảnh tối đa 100 ký tự.'), HORSE_REPORT_MAX_PHOTOS, `Tối đa ${HORSE_REPORT_MAX_PHOTOS} nhãn ảnh.`),
};

/**
 * Tạo nhật ký ngựa. Không có `reportStatus` = nhật ký cũ (bất biến); có `reportStatus` (DRAFT | SENT) = báo cáo sức khỏe.
 */
export const createHorseLogSchema = z.object({
  horseId: legIdSchema,
  correctsLogId: legIdSchema.optional().nullable(),
  reportStatus: z.nativeEnum(HorseReportStatus, { errorMap: () => ({ message: 'Trạng thái báo cáo không hợp lệ (DRAFT, SENT).' }) }).optional(),
  ...horseReportFields,
}).strict().superRefine((data, context) => {
  noFuture(data.loggedAt, context);
  if (!data.reportStatus) {
    const extra = (['customerNote', 'bodyTempC', 'heartRateBpm', 'appetite', 'sendToCustomer'] as const).filter(key => data[key] !== undefined && data[key] !== null);
    for (const key of extra) {
      context.addIssue({ code: z.ZodIssueCode.custom, path: [key], message: 'Trường của báo cáo sức khỏe cần kèm reportStatus (DRAFT hoặc SENT).' });
    }
  }
});

/** Sửa nháp: thay toàn bộ nội dung chỉnh được (trường vắng = xóa), không đổi ngựa / bản được đính chính / trạng thái. */
export const updateHorseReportSchema = z.object({
  ...horseReportFields,
  removeAttachmentIds: formList(legIdSchema, HORSE_REPORT_MAX_PHOTOS, 'Xóa tối đa 3 ảnh mỗi lần.'),
}).strict().superRefine((data, context) => noFuture(data.loggedAt, context));
export type UpdateHorseReportInput = z.infer<typeof updateHorseReportSchema>;

export const sendHorseReportSchema = z.object({ sendToCustomer: formBoolean.optional() }).strict();
export type CreateHorseLogInput = z.infer<typeof createHorseLogSchema>;

/** Số từ multipart (chuỗi) hoặc JSON (number); chuỗi rỗng đã bị normalizeForm bỏ. */
const coordinateSchema = (min: number, max: number, label: string) => z.coerce.number({ invalid_type_error: `${label} phải là số.` })
  .refine(Number.isFinite, `${label} phải là số.`)
  .refine(value => value >= min && value <= max, `${label} phải trong khoảng ${min}..${max}.`);

export const createIncidentSchema = z.object({
  incidentType: z.nativeEnum(IncidentType, {
    errorMap: () => ({ message: 'Loại sự cố không hợp lệ (VEHICLE_BREAKDOWN, LONG_TRAFFIC_JAM, HORSE_MEDICAL).' }),
  }),
  description: z.string().trim().min(5, 'Mô tả sự cố tối thiểu 5 ký tự.').max(2000, 'Mô tả sự cố tối đa 2000 ký tự.'),
  legId: legIdSchema.optional().nullable(),
  horseId: legIdSchema.optional().nullable(),
  severity: z.nativeEnum(IncidentSeverity, {
    errorMap: () => ({ message: 'Mức độ sự cố là bắt buộc (RED, ORANGE, YELLOW).' }),
  }),
  subType: z.string().trim().max(40, 'Loại con tối đa 40 ký tự.').optional().nullable(),
  damageTarget: z.nativeEnum(DamageTarget, {
    errorMap: () => ({ message: 'Hư hại liên quan tới là bắt buộc (VEHICLE, HORSE, BOTH).' }),
  }),
  latitude: coordinateSchema(-90, 90, 'Vĩ độ').optional().nullable(),
  longitude: coordinateSchema(-180, 180, 'Kinh độ').optional().nullable(),
  locationText: z.string().trim().max(255, 'Vị trí tối đa 255 ký tự.').optional().nullable(),
  // Multipart: một nhãn là chuỗi, nhiều nhãn là mảng (field `captions` lặp lại).
  captions: z.preprocess(
    value => (value === undefined || value === null ? [] : Array.isArray(value) ? value : [value]),
    z.array(z.string().trim().max(100, 'Nhãn ảnh tối đa 100 ký tự.')).max(3, 'Tối đa 3 nhãn ảnh.'),
  ),
}).strict().superRefine((data, context) => {
  if (data.incidentType === IncidentType.HORSE_MEDICAL && !data.horseId) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['horseId'],
      message: 'Sự cố y tế ngựa (HORSE_MEDICAL) bắt buộc phải chọn con ngựa bị ảnh hưởng.',
    });
  }
  if (data.subType && !isValidSubType(data.incidentType, data.subType)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ['subType'],
      message: 'Loại con không thuộc loại sự cố đã chọn.',
    });
  }
  if ((data.latitude === undefined || data.latitude === null) !== (data.longitude === undefined || data.longitude === null)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: [data.latitude === undefined || data.latitude === null ? 'latitude' : 'longitude'],
      message: 'Tọa độ phải gửi đủ cả vĩ độ và kinh độ.',
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


// GPS (kế hoạch Bước 6): lô 1–20 điểm để gửi bù khi mất mạng.
export const MAX_POSITIONS_PER_BATCH = 20;
const MAX_POSITION_AGE_MS = 24 * 60 * 60_000;

const positionPointSchema = z.object({
  latitude: z.number({ invalid_type_error: 'Vĩ độ phải là số.' }).min(-90, 'Vĩ độ phải trong khoảng -90..90.').max(90, 'Vĩ độ phải trong khoảng -90..90.'),
  longitude: z.number({ invalid_type_error: 'Kinh độ phải là số.' }).min(-180, 'Kinh độ phải trong khoảng -180..180.').max(180, 'Kinh độ phải trong khoảng -180..180.'),
  recordedAt: milestoneTimeSchema,
  accuracyM: z.number().int().min(0).max(1_000_000).optional(),
  speedMps: z.number().min(0).max(150, 'Tốc độ không hợp lệ.').optional(),
  headingDeg: z.number().min(0).lt(360).optional(),
}).strict().superRefine((point, context) => {
  // (0, 0) là giá trị rác thường gặp khi thiết bị chưa có tín hiệu.
  if (point.latitude === 0 && point.longitude === 0) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['latitude'], message: 'Tọa độ (0, 0) không hợp lệ.' });
  }
  const timestamp = Date.parse(point.recordedAt);
  if (timestamp > Date.now() + CLOCK_SKEW_MS) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recordedAt'], message: 'Thời điểm ghi vị trí không được ở tương lai.' });
  }
  if (Date.now() - timestamp > MAX_POSITION_AGE_MS) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['recordedAt'], message: 'Vị trí cũ hơn 24 giờ không được nhận.' });
  }
});

export const positionsBatchSchema = z.object({
  points: z.array(positionPointSchema)
    .min(1, 'Cần ít nhất 1 điểm vị trí.')
    .max(MAX_POSITIONS_PER_BATCH, `Tối đa ${MAX_POSITIONS_PER_BATCH} điểm mỗi lần gửi.`),
}).strict();
export type PositionsBatchInput = z.infer<typeof positionsBatchSchema>;

/** `?since=` của vệt đường: UTC ISO tùy chọn. */
export const trackQuerySchema = z.object({ since: milestoneTimeSchema.optional() });

/** Ghi hoạt động chăm sóc (gap-analysis-escort.md mục 4.2): đúng trường theo loại, trường không thuộc loại phải rỗng (khớp CHECK ở DB). */
const blank = (value: unknown) => value === undefined || value === null;

export function buildCareActivitySchema(maxRetroactiveMinutes = DEFAULT_MAX_RETROACTIVE_MINUTES) {
  return z.object({
    activityType: z.nativeEnum(CareActivityType, { errorMap: () => ({ message: 'Loại hoạt động không hợp lệ (FEED, WATER, REST).' }) }),
    horseId: legIdSchema.optional().nullable(),
    feedDescription: z.string().trim().min(1, 'Khẩu phần không được để trống.').max(200, 'Khẩu phần tối đa 200 ký tự.').optional().nullable(),
    amountLiters: z.number({ invalid_type_error: 'Lượng nước phải là số.' }).min(0.1, 'Lượng nước tối thiểu 0,1 L.').max(200, 'Lượng nước tối đa 200 L.')
      .refine(value => Math.abs(Math.round(value * 10) / 10 - value) < 1e-9, 'Lượng nước chỉ có tối đa 1 chữ số thập phân.').optional().nullable(),
    durationMinutes: z.number({ invalid_type_error: 'Thời gian nghỉ phải là số.' }).int('Thời gian nghỉ phải là số phút nguyên.')
      .min(1, 'Thời gian nghỉ tối thiểu 1 phút.').max(720, 'Thời gian nghỉ tối đa 720 phút.').optional().nullable(),
    note: z.string().trim().max(255, 'Ghi chú tối đa 255 ký tự.').optional().nullable(),
    performedAt: milestoneTimeSchema,
    correctsActivityId: legIdSchema.optional().nullable(),
  }).strict().superRefine((input, context) => {
    const issue = (path: string, message: string) => context.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    const needs = (field: 'horseId' | 'feedDescription' | 'amountLiters' | 'durationMinutes', label: string) => { if (blank(input[field])) issue(field, label + ' là bắt buộc.'); };
    const mustBeEmpty = (field: 'feedDescription' | 'amountLiters' | 'durationMinutes', label: string) => { if (!blank(input[field])) issue(field, label + ' không áp dụng cho loại hoạt động này.'); };
    if (input.activityType === CareActivityType.FEED) {
      needs('horseId', 'Ngựa'); needs('feedDescription', 'Khẩu phần');
      mustBeEmpty('amountLiters', 'Lượng nước'); mustBeEmpty('durationMinutes', 'Thời gian nghỉ');
    } else if (input.activityType === CareActivityType.WATER) {
      needs('horseId', 'Ngựa'); needs('amountLiters', 'Lượng nước');
      mustBeEmpty('feedDescription', 'Khẩu phần'); mustBeEmpty('durationMinutes', 'Thời gian nghỉ');
    } else {
      needs('durationMinutes', 'Thời gian nghỉ');
      mustBeEmpty('feedDescription', 'Khẩu phần'); mustBeEmpty('amountLiters', 'Lượng nước');
    }
    checkOccurredAt(input.performedAt, maxRetroactiveMinutes, context, 'performedAt');
  });
}
export const careActivitySchema = buildCareActivitySchema();
export type CareActivityInput = z.infer<typeof careActivitySchema>;

/** `from` / `to` của GET care-activities: cùng có hoặc cùng không; UTC ISO; to > from; tối đa 7 ngày. */
export const MAX_CARE_RANGE_MS = 7 * 24 * 60 * 60 * 1000;
export const careRangeSchema = z.object({
  from: milestoneTimeSchema.optional(),
  to: milestoneTimeSchema.optional(),
}).superRefine(({ from, to }, context) => {
  if ((from === undefined) !== (to === undefined)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: [from === undefined ? 'from' : 'to'], message: 'Phải gửi cả from và to, hoặc không gửi.' });
    return;
  }
  if (from === undefined || to === undefined) return;
  const span = Date.parse(to) - Date.parse(from);
  if (span <= 0) context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'to phải sau from.' });
  else if (span > MAX_CARE_RANGE_MS) context.addIssue({ code: z.ZodIssueCode.custom, path: ['to'], message: 'Khoảng thời gian tối đa 7 ngày.' });
});
