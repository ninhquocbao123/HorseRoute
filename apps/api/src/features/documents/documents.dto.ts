import { z } from 'zod';
import { documentReviewSchema, supplementSchema, dossierUpdateSchema } from './documents.validation';
export type DocumentReviewDto = z.infer<typeof documentReviewSchema>;
export type SupplementDto = z.infer<typeof supplementSchema>;
export type DossierUpdateDto = z.infer<typeof dossierUpdateSchema>;

