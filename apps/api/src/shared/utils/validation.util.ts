import { z } from 'zod';
import { BadRequestException } from '../core/error.response';
export function parse<T extends z.ZodTypeAny>(schema: T, value: unknown): z.output<T> {
  const result = schema.safeParse(value);
  if (result.success) return result.data;
  const fields: Record<string, string> = {};
  for (const issue of result.error.issues) {
    if (issue.code === 'unrecognized_keys') {
      for (const key of issue.keys) fields[[...issue.path, key].join('.')] = 'Trường không được hỗ trợ.';
    } else fields[issue.path.join('.') || 'body'] ??= issue.message;
  }
  throw new BadRequestException({ message: 'Vui lòng kiểm tra các trường được đánh dấu.', fields });
}
export const idSchema = z.string().regex(/^[1-9]\d{0,19}$/, 'ID không hợp lệ.');
export const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value => {
  const date = new Date(value);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}, 'Ngày không hợp lệ.');
// Legacy DTO optional fields accepted null as absent.
export const optional = <T extends z.ZodTypeAny>(schema: T) => z.preprocess(value => value === null ? undefined : value, schema.optional());

