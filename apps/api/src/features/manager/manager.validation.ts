import { z } from 'zod';
import { estimateSchema } from '../pricing/pricing.validation';
export const quoteSchema=z.object({input:estimateSchema,adjustment:z.number().int().min(-10000000000).max(10000000000),reason:z.string().trim().max(2000),vatPercent:z.number().min(0).max(100)}).strict().refine(v=>v.adjustment===0||v.reason.length>=3,{path:['reason'],message:'Cần lý do điều chỉnh giá.'});
export const quoteReviewSchema=z.object({revision:z.number().int().positive(),decision:z.enum(['APPROVED','NEED_REVISION']),note:z.string().trim().max(2000)}).strict().refine(v=>v.decision==='APPROVED'||v.note.length>=3,{path:['note'],message:'Cần ghi rõ nội dung yêu cầu điều chỉnh.'});
export const receiptSchema=z.object({amount:z.number().int().positive().max(100000000000),reference:z.string().trim().min(3).max(120),receivedAt:z.string().datetime({offset:true})}).strict();
export const reportSchema=z.object({year:z.coerce.number().int().min(2000).max(2100),month:z.coerce.number().int().min(1).max(12).optional()}).strict();
