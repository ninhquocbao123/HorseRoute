import { z } from 'zod';
import { tripIdSchema } from '../trips/trips.validation';

// Written once by Order approval, updated only when a specialist adds a document requirement.
export const requirementsSchema = z.object({
  version: z.literal(2),
  horses: z.array(z.object({
    horseId: tripIdSchema,
    documents: z.array(z.object({ documentTypeId: tripIdSchema, hasExpiry: z.boolean() }).strict()),
    authorityIds: z.array(tripIdSchema),
  }).strict()).min(1),
}).strict();
export type Requirements = z.infer<typeof requirementsSchema>;
