export type VehicleClass = 'LIGHT' | 'MEDIUM' | 'HEAVY';
export type InsuranceCode = 'NONE' | 'THOROUGHBRED' | 'ARABIAN' | 'QUARTER_HORSE' | 'WARMBLOOD' | 'APPALOOSA' | 'OTHER';
export interface PricingConfig {
  currency: 'VND';
  distanceRates: { km: number; light: number; medium: number; heavy: number }[];
  fees: { crewPerDay: number; fuelPer100Km: number; extraStallPerHorse: number; premiumFeedPerHorse: number; sportFeedPerHorse: number; water2hPerHorse: number; water1hPerHorse: number; internationalPerTrip: number };
  insurance: Record<Exclude<InsuranceCode, 'NONE'>, number>;
  depositPercent: number;
  quoteValidityHours: number;
}
export interface PricingVersion {
  id: string; title: string; note: string | null; status: 'DRAFT' | 'PUBLISHED'; revision: number;
  effectiveFrom: string | null; publishedAt: string | null; createdAt: string; updatedAt: string;
  createdByName: string | null; publishedByName: string | null; config: PricingConfig;
}
export interface EstimateInput {
  distanceKm: number; vehicleClass: VehicleClass; horseCount: number; durationDays: number;
  insurance: InsuranceCode; feed: 'STANDARD' | 'PREMIUM' | 'SPORT'; extraStall: boolean;
  international: boolean; water: 'EVERY_2_HOURS' | 'EVERY_HOUR'; waterRounds: number;
}
export interface PriceEstimate {
  versionId: string; currency: 'VND'; distanceBandKm: number;
  items: { code: string; label: string; quantity: number; unitPrice: number; amount: number }[];
  total: number; deposit: number; balance: number; depositPercent: number; quoteValidityHours: number;
}
export const vehicleCapacities: Record<VehicleClass, number> = { LIGHT: 2, MEDIUM: 6, HEAVY: 9 };
export function calculateEstimate(config: PricingConfig, input: EstimateInput, versionId: string): PriceEstimate {
  if (!Number.isInteger(input.horseCount) || input.horseCount < 1 || input.horseCount > vehicleCapacities[input.vehicleClass]) throw new Error('Số ngựa vượt sức chứa hạng xe.');
  const band = config.distanceRates.find(row => row.km >= input.distanceKm);
  if (!band) throw new Error('Quãng đường vượt phạm vi bảng giá. Cần báo giá riêng.');
  const items: PriceEstimate['items'] = [];
  const add = (code: string, label: string, quantity: number, unitPrice: number) => items.push({ code, label, quantity, unitPrice, amount: Math.round(quantity * unitPrice) });
  const vehicle = input.vehicleClass.toLowerCase() as 'light' | 'medium' | 'heavy';
  const index = config.distanceRates.indexOf(band);
  // Anchor prices remain unchanged; between anchors charge only the excess km.
  const base = index > 0 && input.distanceKm < band.km ? config.distanceRates[index - 1] : band;
  add('TRANSPORT', `Cước xe ${input.vehicleClass} · gồm ${base.km} km`, 1, base[vehicle]);
  if (input.distanceKm > base.km) {
    const excessKm = input.distanceKm - base.km;
    const perKm = (band[vehicle] - base[vehicle]) / (band.km - base.km);
    add('EXCESS_DISTANCE', `Vượt ${excessKm} km × ${perKm.toLocaleString('vi-VN', { maximumFractionDigits: 2 })} đ/km`, excessKm, perKm);
  }
  add('CREW', 'Tài xế + hộ tống / ngày', input.durationDays, config.fees.crewPerDay);
  add('FUEL', 'Nhiên liệu, cầu đường / 100 km', input.distanceKm / 100, config.fees.fuelPer100Km);
  if (input.waterRounds > 0) add('WATER', `Cữ nước ${input.water === 'EVERY_HOUR' ? 'mỗi giờ' : 'mỗi 2 giờ'} / ngựa / cữ`, input.horseCount * input.waterRounds, input.water === 'EVERY_HOUR' ? config.fees.water1hPerHorse : config.fees.water2hPerHorse);
  if (input.extraStall) add('EXTRA_STALL', 'Khoang đơn mở rộng / ngựa', input.horseCount, config.fees.extraStallPerHorse);
  if (input.feed !== 'STANDARD') add('FEED', 'Thức ăn / ngựa / chuyến', input.horseCount, input.feed === 'PREMIUM' ? config.fees.premiumFeedPerHorse : config.fees.sportFeedPerHorse);
  if (input.international) add('INTERNATIONAL', 'Kiểm dịch, hải quan quốc tế / chuyến', 1, config.fees.internationalPerTrip);
  if (input.insurance !== 'NONE') add('INSURANCE', 'Bảo hiểm động vật sống / ngựa', input.horseCount, config.insurance[input.insurance]);
  const total = items.reduce((sum, row) => sum + row.amount, 0), deposit = Math.round(total * config.depositPercent / 100);
  return { versionId, currency: 'VND', distanceBandKm: band.km, items, total, deposit, balance: total - deposit, depositPercent: config.depositPercent, quoteValidityHours: config.quoteValidityHours };
}
