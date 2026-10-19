import { z } from 'zod';
import { isCountryCode } from '@my-project/shared';
import { idSchema, dateSchema, optional } from '../../shared/utils/validation.util';
import { paginationSchema } from '../../shared/utils/pagination.util';
export const horseSchema = z.object({
  id: optional(idSchema), name: z.string().trim().min(1).max(100), passportNo: z.string().trim().min(1).max(50),
  breed: optional(z.string().max(50)), birthDate: optional(dateSchema), sex: optional(z.string().max(10)),
  coatColor: optional(z.string().max(30)), note: optional(z.string().max(255)),
}).strict();
export const draftHorseSchema = z.object({
  id: optional(idSchema), name: optional(z.string().max(100)), passportNo: optional(z.string().max(50)),
  breed: optional(z.string().max(50)), birthDate: optional(z.string().max(10)), sex: optional(z.string().max(10)),
  coatColor: optional(z.string().max(30)), note: optional(z.string().max(255)),
}).strict();
export const draftOrderSchema = z.object({
  requestId: optional(z.string().uuid()), originAddress: optional(z.string().max(255)), originCountry: optional(z.string().max(2)),
  destinationAddress: optional(z.string().max(255)), destinationCountry: optional(z.string().max(2)),
  desiredDepartureDate: optional(z.string().max(10)), specialRequirements: optional(z.string().max(5000)),
  horses: z.array(draftHorseSchema).max(50),
}).strict();
export const orderSchema = z.object({
  originAddress: z.string().trim().min(1).max(255), originCountry: z.string().refine(isCountryCode,'Chọn quốc gia / vùng lãnh thổ hợp lệ.'),
  destinationAddress: z.string().trim().min(1).max(255), destinationCountry: z.string().refine(isCountryCode,'Chọn quốc gia / vùng lãnh thổ hợp lệ.'),
  desiredDepartureDate: dateSchema, specialRequirements: optional(z.string().max(5000)), horses: z.array(horseSchema).min(1).max(50),
}).strict();
export const reviewSchema = z.object({
  decision: z.enum(['APPROVED','REJECTED','NEED_INFO']), reason: optional(z.string().max(2000)),
  coordinatorId: optional(idSchema), ruleIds: optional(z.array(idSchema).max(30)),
}).strict();
export const orderQuerySchema = paginationSchema.extend({
  group: optional(z.enum(['pending','approved','documents','closed'])),
  status: optional(z.enum(['DRAFT','PENDING','NEED_INFO','REJECTED','APPROVED','PREPARING','READY','IN_TRANSIT','DELIVERED','CANCELLED'])),
  search: optional(z.string().max(50)),
}).strict();

