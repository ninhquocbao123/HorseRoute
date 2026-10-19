import { z } from 'zod';
export const loginSchema = z.object({
  email: z.string().trim().toLowerCase().email().max(100), password: z.string().min(1).max(72),
}).strict();
export const registerSchema = loginSchema.extend({
  password: z.string().min(8).max(72).regex(/\S/, 'Mật khẩu không được chỉ gồm khoảng trắng.').refine(value => Buffer.byteLength(value, 'utf8') <= 72, 'Mật khẩu không được vượt quá 72 byte UTF-8.'),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().regex(/^\+?[0-9]{9,15}$/, 'Số điện thoại cần 9–15 chữ số, có thể bắt đầu bằng +.'),
  address: z.string().trim().min(5).max(255),
}).strict();

