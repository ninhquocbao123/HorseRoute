import { z } from 'zod';
import { paginationSchema } from '../../shared/utils/pagination.util';
import { idSchema } from '../../shared/utils/validation.util';
export { routePlanWriteSchema, routePreviewSchema } from './trip-route-plan';
export const tripIdSchema = idSchema.refine(id => id.length < 20 || (id.length === 20 && id <= '18446744073709551615'), 'ID vượt giới hạn BIGINT UNSIGNED.');
export const tripQuerySchema = paginationSchema.refine(
  ({ page, limit }) => Number.isSafeInteger(page) && Number.isSafeInteger((page - 1) * limit),
  { message: 'Trang vượt giới hạn phân trang.', path: ['page'] },
);

// schema.sql uses DATETIME(0): accept seconds or .000, never silently round a plan.
const planTime = z.string().datetime({ offset: false }).refine(value => {
  if (!/^[1-9]\d{3}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.000)?Z$/.test(value)) return false;
  const date = new Date(value);
  return Number.isFinite(date.getTime()) && date.toISOString() === value.replace(/(?<!\.000)Z$/, '.000Z');
}, 'Ngày giờ phải tồn tại, UTC có Z, chính xác đến giây (có thể dùng .000Z).');

export function vietnamCalendarDate(value: string): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Ho_Chi_Minh', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) => parts.find(part => part.type === type)?.value ?? '';
  return `${read('year')}-${read('month')}-${read('day')}`;
}

export function isSameVietnamCalendarDate(first: string, second: string): boolean {
  return vietnamCalendarDate(first) === vietnamCalendarDate(second);
}
export const legacyTripPlanSchema = z.object({
  legs: z.array(z.object({
    id: tripIdSchema.optional(), fromLocationId: tripIdSchema, toLocationId: tripIdSchema,
    vehicleId: tripIdSchema.nullable().optional(), plannedDepartureAt: planTime, plannedArrivalAt: planTime,
  }).strict()).min(1).max(50),
}).strict().superRefine(({ legs }, context) => {
  const seen = new Set<string>();
  const issue = (index: number, field: string, message: string) => context.addIssue({ code: z.ZodIssueCode.custom, path: ['legs', index, field], message });
  legs.forEach((leg, index) => {
    if (leg.id && seen.has(leg.id)) issue(index, 'id', 'ID chặng bị trùng.');
    if (leg.id) seen.add(leg.id);
    if (leg.fromLocationId === leg.toLocationId) issue(index, 'toLocationId', 'Điểm đến phải khác điểm đi.');
    if (Date.parse(leg.plannedArrivalAt) < Date.parse(leg.plannedDepartureAt)) issue(index, 'plannedArrivalAt', 'Giờ đến không được trước giờ đi.');
    if (index > 0) {
      if (legs[index - 1].toLocationId !== leg.fromLocationId) issue(index, 'fromLocationId', 'Điểm đi phải bằng điểm đến chặng trước.');
      if (Date.parse(leg.plannedDepartureAt) < Date.parse(legs[index - 1].plannedArrivalAt)) issue(index, 'plannedDepartureAt', 'Giờ đi không được trước giờ đến chặng trước.');
    }
  });
});
export const tripScheduleSchema = z.object({
  plannedDepartureAt: planTime,
  plannedArrivalAt: planTime,
  routePlanRevision: z.number().int().min(0).max(2_147_483_647),
}).strict().superRefine((value, context) => {
  if (isSameVietnamCalendarDate(value.plannedDepartureAt, value.plannedArrivalAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['plannedArrivalAt'], message: 'Ngày giao dự kiến không được trùng với Ngày khởi hành dự kiến.' });
  }
  if (Date.parse(value.plannedArrivalAt) <= Date.parse(value.plannedDepartureAt)) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ['plannedArrivalAt'], message: 'Ngày giờ giao dự kiến phải sau ngày giờ khởi hành dự kiến.' });
  }
});
// Giữ payload legs cũ cho chuyến legacy; Coordinator mới chỉ gửi lịch tổng + revision của route_plan.
export const tripPlanSchema = z.union([tripScheduleSchema, legacyTripPlanSchema]);
export type TripPlanInput = z.infer<typeof tripPlanSchema>;
export type LegacyTripPlanInput = z.infer<typeof legacyTripPlanSchema>;
export type TripScheduleInput = z.infer<typeof tripScheduleSchema>;

export const submitTripPlanSchema = z.object({}).strict();

export const reviewTripPlanSchema = z.discriminatedUnion('decision', [
  z.object({ decision: z.literal('APPROVED') }).strict(),
  z.object({ decision: z.literal('RETURNED'), reason: z.string().trim().min(1).max(255) }).strict(),
]);
export type ReviewTripPlanInput = z.infer<typeof reviewTripPlanSchema>;

export { tripFleetSchema as tripAssignmentsSchema } from './trip-fleet.schema';
export type { TripFleetInput as TripAssignmentsInput } from './trip-fleet.schema';
