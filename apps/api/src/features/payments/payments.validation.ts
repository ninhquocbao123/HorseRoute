import { z } from 'zod';
import { idSchema } from '../../shared/utils/validation.util';

export const createPaymentSessionSchema = z.object({
  orderId: idSchema,
  paymentType: z.enum(['DEPOSIT', 'BALANCE']),
  paymentMethod: z.enum(['BANK_TRANSFER', 'E_WALLET', 'CARD']),
});

export const completePaymentSessionSchema = z.object({
  result: z.enum(['SUCCESS', 'FAILED', 'CANCELLED']),
  failureReason: z.string().max(500).optional(),
});

export type CreatePaymentSessionDto = z.infer<typeof createPaymentSessionSchema>;
export type CompletePaymentSessionDto = z.infer<typeof completePaymentSessionSchema>;

