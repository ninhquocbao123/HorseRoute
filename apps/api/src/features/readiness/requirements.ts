import { z } from 'zod';
import { tripIdSchema } from '../trips/trips.validation';

// Written once by Order approval, never reconstructed from mutable rules on a read.
export const requirementsSchema = z.object({
  version: z.literal(1), ruleIds: z.array(tripIdSchema).min(1),
  horses: z.array(z.object({
    horseId: tripIdSchema,
    documents: z.array(z.object({ documentTypeId: tripIdSchema, hasExpiry: z.boolean() }).strict()),
    authorityIds: z.array(tripIdSchema),
  }).strict()).min(1),
}).strict();
export type Requirements = z.infer<typeof requirementsSchema>;
