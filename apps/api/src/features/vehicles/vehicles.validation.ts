import { z } from 'zod';
import { idSchema } from '../../shared/utils/validation.util';

export const vehicleIdSchema = idSchema.refine(id => id.length < 20 || (id.length === 20 && id <= '18446744073709551615'), 'ID vượt giới hạn BIGINT UNSIGNED.');
export const VEHICLE_TYPES = ['TRUCK', 'AIRCRAFT_HOLD', 'CRATE'] as const;
export const MAX_CAPACITY_STALLS = 100;

export const vehicleQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  status: z.enum(['all', 'active', 'inactive']).default('all'),
  q: z.string().trim().max(30).optional(),
}).strict().refine(({ page, limit }) => Number.isSafeInteger((page - 1) * limit), { message: 'Trang vượt giới hạn phân trang.', path: ['page'] });

const fields = {
  plateOrCode: z.string().trim().min(1, 'Biển số hoặc mã xe là bắt buộc.').max(30, 'Tối đa 30 ký tự.'),
  vehicleType: z.enum(VEHICLE_TYPES, { errorMap: () => ({ message: 'Loại phương tiện không hợp lệ.' }) }),
  capacityStalls: z.number({ invalid_type_error: 'Sức chứa phải là số nguyên.', required_error: 'Sức chứa là bắt buộc.' })
    .int('Sức chứa phải là số nguyên.').min(1, 'Sức chứa tối thiểu 1 chỗ.').max(MAX_CAPACITY_STALLS, `Sức chứa tối đa ${MAX_CAPACITY_STALLS} chỗ.`),
};
export const createVehicleSchema = z.object(fields).strict();
export const updateVehicleSchema = z.object({ ...fields, isActive: z.boolean({ invalid_type_error: 'Trạng thái phải là true/false.', required_error: 'Trạng thái là bắt buộc.' }) }).strict();
export type CreateVehicleInput = z.infer<typeof createVehicleSchema>;
export type UpdateVehicleInput = z.infer<typeof updateVehicleSchema>;
