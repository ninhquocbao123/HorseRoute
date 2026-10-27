import { z } from 'zod';
const money = z.number().int().min(0).max(10000000000);
const row = z.object({km:z.number().int().min(1).max(10000),light:money,medium:money,heavy:money}).strict();
export const pricingConfigSchema = z.object({
 currency:z.literal('VND'), distanceRates:z.array(row).min(1).max(30),
 fees:z.object({crewPerDay:money,fuelPer100Km:money,extraStallPerHorse:money,premiumFeedPerHorse:money,sportFeedPerHorse:money,water2hPerHorse:money,water1hPerHorse:money,internationalPerTrip:money}).strict(),
 insurance:z.object({THOROUGHBRED:money,ARABIAN:money,QUARTER_HORSE:money,WARMBLOOD:money,APPALOOSA:money,OTHER:money}).strict(),
 depositPercent:z.number().int().min(0).max(100),quoteValidityHours:z.number().int().min(1).max(168),
}).strict().superRefine((config,context)=>{
 config.distanceRates.forEach((rate,i)=>{
  if(i&&rate.km<=config.distanceRates[i-1].km)context.addIssue({code:'custom',path:['distanceRates',i,'km'],message:'Mốc km phải tăng dần và không trùng.'});
  if(rate.light>rate.medium||rate.medium>rate.heavy)context.addIssue({code:'custom',path:['distanceRates',i],message:'Giá Light ≤ Medium ≤ Heavy.'});
  if(i&&(['light','medium','heavy'] as const).some(key=>rate[key]<config.distanceRates[i-1][key]))context.addIssue({code:'custom',path:['distanceRates',i],message:'Giá không được giảm khi quãng đường tăng.'});
 });
 if(config.fees.sportFeedPerHorse<config.fees.premiumFeedPerHorse)context.addIssue({code:'custom',path:['fees','sportFeedPerHorse'],message:'Gói thể thao không được thấp hơn gói nâng cao.'});
 if(config.fees.water1hPerHorse<config.fees.water2hPerHorse)context.addIssue({code:'custom',path:['fees','water1hPerHorse'],message:'Giá cữ nước mỗi giờ không được thấp hơn mỗi 2 giờ.'});
});
export const draftPricingSchema=z.object({title:z.string().trim().min(3).max(120),note:z.string().trim().max(2000),config:pricingConfigSchema}).strict();
export const updatePricingSchema=draftPricingSchema.extend({revision:z.number().int().min(1)});
export const publishPricingSchema=z.object({revision:z.number().int().min(1),effectiveFrom:z.string().datetime({offset:true}).optional()}).strict();
export const estimateSchema=z.object({distanceKm:z.number().int().min(1).max(10000),vehicleClass:z.enum(['LIGHT','MEDIUM','HEAVY']),vehicleCapacity:z.union([z.literal(2),z.literal(4),z.literal(6),z.literal(9)]).optional(),horseCount:z.number().int().min(1).max(9),durationDays:z.number().int().min(1).max(60),insurance:z.enum(['NONE','THOROUGHBRED','ARABIAN','QUARTER_HORSE','WARMBLOOD','APPALOOSA','OTHER']),feed:z.enum(['STANDARD','PREMIUM','SPORT']),extraStall:z.boolean(),international:z.boolean(),water:z.enum(['EVERY_2_HOURS','EVERY_HOUR']),waterRounds:z.number().int().min(0).max(1000)}).strict();
