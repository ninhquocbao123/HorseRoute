import { z } from 'zod';
import { idSchema, dateSchema, optional } from '../../shared/utils/validation.util';
export const documentReviewSchema = z.object({ status: z.enum(['VALID','INVALID']), versionId: idSchema,
  reason: optional(z.string().max(255)), expiryDate: optional(dateSchema),
}).strict();
export const supplementSchema = z.object({ reason: z.string().regex(/\S/).max(255) }).strict();
export const dossierUpdateSchema = z.object({ status: z.enum(['SUBMITTED','REVIEWING','NEED_INFO','APPROVED','REJECTED']),
  date: dateSchema, receiptCode: optional(z.string().max(50)), reason: optional(z.string().max(255)),
}).strict();

