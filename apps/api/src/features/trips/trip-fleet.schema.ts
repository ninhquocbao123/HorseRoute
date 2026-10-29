import { z } from 'zod';
const id = z.string().regex(/^[1-9]\d{0,19}$/).refine(v => BigInt(v) <= 18446744073709551615n);
export const tripFleetSchema = z.object({ vehicles: z.array(z.object({
  vehicleId: id,
  horseCount: z.number().int().positive(),
  crew: z.array(z.object({ userId: id, role: z.enum(['DRIVER', 'ESCORT']) }).strict()).min(2).max(4),
}).strict()).min(1).max(50) }).strict().superRefine(({ vehicles }, ctx) => {
  const seenVehicles = new Set<string>(), people = new Set<string>();
  vehicles.forEach((v, i) => {
    if (seenVehicles.has(v.vehicleId)) ctx.addIssue({ code: 'custom', path: ['vehicles', i, 'vehicleId'], message: 'Một xe chỉ được chọn một lần.' });
    seenVehicles.add(v.vehicleId);
    for (const role of ['DRIVER', 'ESCORT']) {
      const n = v.crew.filter(p => p.role === role).length;
      if (n < 1 || n > 2) ctx.addIssue({ code: 'custom', path: ['vehicles', i, 'crew'], message: `Xe ${v.vehicleId}: cần 1–2 ${role === 'DRIVER' ? 'tài xế' : 'lơ xe'}.` });
    }
    v.crew.forEach((p, j) => {
      if (people.has(p.userId)) ctx.addIssue({ code: 'custom', path: ['vehicles', i, 'crew', j, 'userId'], message: 'Một người chỉ được phân công một lần trong chuyến.' });
      people.add(p.userId);
    });
  });
});
export type TripFleetInput = z.infer<typeof tripFleetSchema>;
