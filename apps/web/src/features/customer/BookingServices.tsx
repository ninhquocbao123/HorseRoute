import { useEffect, useState } from 'react';
import type { EstimateInput, PricingConfig } from '@my-project/shared';
import { api } from '../../lib/axios';
import type { Profile } from './CustomerJourney';
import './booking-services.css';

type Services = Pick<EstimateInput, 'extraStall' | 'feed' | 'water' | 'waterRounds' | 'insurance'>;
const insuranceGroups = [['THOROUGHBRED', 'Thoroughbred'], ['ARABIAN', 'Arabian'], ['QUARTER_HORSE', 'Quarter Horse'], ['WARMBLOOD', 'Warmblood'], ['APPALOOSA', 'Appaloosa'], ['OTHER', 'Khác']] as const;
type Option = { value: string; title: string; description: string; price?: string };
function Options({ title, value, options, onChange }: { title: string; value: string; options: Option[]; onChange: (value: string) => void }) {
  return <fieldset className="bs-group"><legend>{title}</legend><div className={'bs-options bs-options-' + options.length}>{options.map(option => <label key={option.value} className={value === option.value ? 'selected' : ''}>
    <input type="radio" name={'service-' + title} checked={value === option.value} onChange={() => onChange(option.value)} />
    <span><strong>{option.title}</strong><small>{option.description}</small>{option.price && <em>{option.price}</em>}</span>
  </label>)}</div></fieldset>;
}

export default function BookingServices({ value, onChange, horses }: { value: Services; onChange: (patch: Partial<Services>) => void; horses: Profile[] }) {
  const [pricing, setPricing] = useState<PricingConfig | null>(null);
  useEffect(() => { let active = true; void api.get('/pricing/current').then(r => { if (active) setPricing(r.data.config ?? null); }).catch(() => {}); return () => { active = false; }; }, []);
  const fee = (amount: number | undefined, unit = 'ngựa / chuyến') => amount == null ? 'Theo bảng giá hiện hành' : '+' + amount.toLocaleString('vi-VN') + ' đ / ' + unit;
  return <div className="booking-services">
    <header><h3>Dịch vụ & bảo hiểm</h3><p>{horses.map(h => h.name).join(', ')}</p><small>Các lựa chọn bên dưới áp dụng cho {horses.length} ngựa trong chuyến.</small></header>
    <Options title="Khoang trên xe" value={value.extraStall ? 'EXTRA' : 'STANDARD'} onChange={v => onChange({ extraStall: v === 'EXTRA' })} options={[
      { value: 'STANDARD', title: 'Khoang tiêu chuẩn', description: 'Đã gồm trong cước vận chuyển.' },
      { value: 'EXTRA', title: 'Khoang đơn mở rộng', description: 'Thêm không gian cho ngựa.', price: fee(pricing?.fees.extraStallPerHorse) },
    ]} />
    <Options title="Gói thức ăn" value={value.feed} onChange={v => onChange({ feed: v as Services['feed'] })} options={[
      { value: 'STANDARD', title: 'Gói cơ bản', description: 'Thức ăn tiêu chuẩn.', price: 'Đã gồm trong cước' },
      { value: 'PREMIUM', title: 'Gói nâng cao', description: 'Bổ sung gói thức ăn nâng cao.', price: fee(pricing?.fees.premiumFeedPerHorse) },
      { value: 'SPORT', title: 'Gói thể thao', description: 'Gói thức ăn dành cho ngựa thể thao.', price: fee(pricing?.fees.sportFeedPerHorse) },
    ]} />
    <Options title="Cữ nước" value={value.waterRounds ? value.water : 'STANDARD'} onChange={v => onChange(v === 'STANDARD' ? { waterRounds: 0 } : { water: v as Services['water'], waterRounds: Math.max(1, value.waterRounds) })} options={[
      { value: 'STANDARD', title: 'Tiêu chuẩn', description: 'Không thêm cữ nước tính phí.', price: 'Đã gồm trong cước' },
      { value: 'EVERY_2_HOURS', title: 'Mỗi 2 giờ', description: 'Bổ sung cữ nước trong hành trình.', price: fee(pricing?.fees.water2hPerHorse, 'ngựa / cữ') },
      { value: 'EVERY_HOUR', title: 'Mỗi giờ', description: 'Bổ sung cữ nước thường xuyên hơn.', price: fee(pricing?.fees.water1hPerHorse, 'ngựa / cữ') },
    ]} />
    {value.waterRounds > 0 && <label className="bs-extra-field">Số cữ nước bổ sung / ngựa<input type="number" min="1" max="1000" required value={value.waterRounds} onChange={e => onChange({ waterRounds: Number(e.target.value) })} /></label>}
    <Options title="Bảo hiểm chuyến đi" value={value.insurance === 'NONE' ? 'NONE' : 'BUY'} onChange={v => onChange({ insurance: v === 'NONE' ? 'NONE' : insuranceGroups.find(([code]) => horses.every(h => h.breed.toUpperCase().replace(/\s+/g, '_') === code))?.[0] || 'OTHER' })} options={[
      { value: 'BUY', title: 'Mua bảo hiểm', description: 'Phí tính theo nhóm bảo hiểm được chọn.', price: value.insurance !== 'NONE' ? fee(pricing?.insurance[value.insurance]) : undefined },
      { value: 'NONE', title: 'Không mua bảo hiểm', description: 'Không cộng phí bảo hiểm vào dự toán.' },
    ]} />
    {value.insurance !== 'NONE' && <label className="bs-extra-field">Nhóm bảo hiểm<select value={value.insurance} onChange={e => onChange({ insurance: e.target.value as Services['insurance'] })}>{insuranceGroups.map(([code, name]) => <option key={code} value={code}>{name}</option>)}</select></label>}
  </div>;
}
