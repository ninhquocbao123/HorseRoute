import { z } from 'zod';
import { draftOrderSchema, orderSchema, orderQuerySchema, reviewSchema } from './orders.validation';
export type DraftOrderDto = z.infer<typeof draftOrderSchema>;
export type OrderDto = z.infer<typeof orderSchema>;
export type OrderQueryDto = z.infer<typeof orderQuerySchema>;
export type ReviewDto = z.infer<typeof reviewSchema>;

