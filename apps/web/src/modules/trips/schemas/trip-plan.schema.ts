import { z } from 'zod';
export const tripPlanSchema=z.object({legs:z.array(z.object({id:z.string().optional(),fromLocationId:z.string().min(1),toLocationId:z.string().min(1),vehicleId:z.string().optional(),plannedDepartureAt:z.string().min(1),plannedArrivalAt:z.string().min(1)})).min(1).max(50)}).superRefine(({legs},ctx)=>{const seen=new Set<string>();legs.forEach((l,i)=>{if(l.id&&seen.has(l.id))ctx.addIssue({code:'custom',path:['legs',i,'id'],message:'ID chặng bị trùng.'});if(l.id)seen.add(l.id);if(l.fromLocationId===l.toLocationId)ctx.addIssue({code:'custom',path:['legs',i,'toLocationId'],message:'Điểm đến phải khác điểm đi.'});if(new Date(l.plannedArrivalAt)<new Date(l.plannedDepartureAt))ctx.addIssue({code:'custom',path:['legs',i,'plannedArrivalAt'],message:'Giờ đến không được trước giờ đi.'});if(i){const p=legs[i-1];if(p.toLocationId!==l.fromLocationId)ctx.addIssue({code:'custom',path:['legs',i,'fromLocationId'],message:'Điểm đi phải nối chặng trước.'});if(new Date(l.plannedDepartureAt)<new Date(p.plannedArrivalAt))ctx.addIssue({code:'custom',path:['legs',i,'plannedDepartureAt'],message:'Giờ đi phải sau chặng trước.'});}})});
export type TripPlanFormValues=z.infer<typeof tripPlanSchema>;
export const tripScheduleSchema=z.object({
  plannedDepartureAt:z.string().min(1,'Chọn thời gian khởi hành.'),
  plannedArrivalAt:z.string().min(1,'Chọn ngày giờ giao dự kiến.'),
  routePlanRevision:z.number().int().min(0),
}).superRefine((value,ctx)=>{
  const departure=Date.parse(value.plannedDepartureAt),arrival=Date.parse(value.plannedArrivalAt);
  if(!Number.isFinite(departure))ctx.addIssue({code:'custom',path:['plannedDepartureAt'],message:'Thời gian khởi hành không hợp lệ.'});
  if(!Number.isFinite(arrival))ctx.addIssue({code:'custom',path:['plannedArrivalAt'],message:'Ngày giờ giao dự kiến không hợp lệ.'});
  if(value.plannedDepartureAt.split('T')[0]===value.plannedArrivalAt.split('T')[0])ctx.addIssue({code:'custom',path:['plannedArrivalAt'],message:'Ngày giao dự kiến không được trùng với Ngày khởi hành dự kiến.'});
  if(Number.isFinite(departure)&&Number.isFinite(arrival)&&arrival<=departure)ctx.addIssue({code:'custom',path:['plannedArrivalAt'],message:'Ngày giờ giao dự kiến phải sau ngày giờ khởi hành dự kiến.'});
});
