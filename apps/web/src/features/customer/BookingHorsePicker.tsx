import { useState } from 'react';
import { Button, Empty, Input, Pagination } from 'antd';
import { SearchOutlined, PlusOutlined, FileTextOutlined, CheckCircleOutlined, EyeOutlined } from '@ant-design/icons';
import type { Profile } from './CustomerJourney';
import './booking-horse-picker.css';

type Props = {
  profiles: Profile[];
  types: { id: string; name: string }[];
  selected: string[];
  onChange: (ids: string[]) => void;
  onAdd: () => void;
  showFile: (path: string, name: string) => Promise<void>;
};
const normalize = (value: string) => value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').toLowerCase();
function age(date: string) {
  const born = new Date(date), now = new Date();
  if (!date || Number.isNaN(born.getTime()) || born > now) return '';
  const years = now.getFullYear() - born.getFullYear() - (now.getMonth() < born.getMonth() || (now.getMonth() === born.getMonth() && now.getDate() < born.getDate()) ? 1 : 0);
  return years < 1 ? 'Dưới 1 tuổi' : `${years} tuổi`;
}

export default function BookingHorsePicker({ profiles, types, selected, onChange, onAdd, showFile }: Props) {
  const [search, setSearch] = useState(''), [page, setPage] = useState(1);
  const matches = profiles.filter(p => normalize(`${p.name} ${p.microchip} ${p.breed}`).includes(normalize(search.trim())));
  const current = Math.min(page, Math.max(1, Math.ceil(matches.length / 6)));
  const documents = [{ label: 'Hộ chiếu', pattern: /hộ chiếu|passport/i }, { label: 'Sổ tiêm', pattern: /tiêm|vaccin/i }, { label: 'Xét nghiệm', pattern: /eia|coggins/i }];
  return <section className="booking-horses" aria-label="Chọn ngựa trong hồ sơ">
    <header><div><h3>Ngựa trong hồ sơ</h3><p aria-live="polite">Đã chọn <strong>{selected.length}</strong> / {profiles.length} ngựa</p></div><Button icon={<PlusOutlined />} onClick={onAdd}>Thêm ngựa</Button></header>
    <Input className="booking-horse-search" prefix={<SearchOutlined />} allowClear aria-label="Tìm ngựa trong hồ sơ" placeholder="Tìm theo tên ngựa, mã microchip, giống…" value={search} onChange={e => { setSearch(e.target.value); setPage(1); }} />
    <div className="booking-horse-list">{matches.slice((current - 1) * 6, current * 6).map(p => {
      const isOccupied = !!p.activeOrderId;
      const chosen = selected.includes(p.id!);
      const articleClass = [
        chosen ? 'is-selected' : '',
        isOccupied ? 'is-occupied' : '',
      ].filter(Boolean).join(' ');
      return <article key={p.id} className={articleClass}>
        <label className={`booking-horse-choice ${isOccupied ? 'is-disabled' : ''}`}>
          <input
            type="checkbox"
            aria-label={p.name}
            checked={chosen}
            disabled={isOccupied}
            onChange={() => onChange(chosen ? selected.filter(id => id !== p.id) : [...selected, p.id!])}
          />
          <span>
            <strong>{p.name}</strong>
            {isOccupied && (
              <small className="occupied-warning">
                ⚠️ Đang thuộc đơn {p.activeOrderCode} · Chưa thể đặt chuyến mới
              </small>
            )}
            <small>{[`Chip ${p.microchip || 'chưa cập nhật'}`, p.breed, p.sex, age(p.birthDate), p.coatColor].filter(Boolean).join(' · ')}</small>
          </span>
        </label>
        <div className="booking-horse-docs">{documents.map(({ label, pattern }) => {
          const type = types.find(t => pattern.test(t.name));
          const file = type && p.files.find(f => f.kind === 'DOCUMENT' && String(f.slot) === String(type.id));
          return <button type="button" key={label} className={file ? 'has-file' : ''} disabled={!file} aria-label={`${label} của ${p.name}: ${file ? 'Đã tải lên, xem tệp' : 'Chưa tải lên'}`} onClick={() => file && void showFile('/customer/files/' + file.id, file.original_name)}>{file ? <CheckCircleOutlined /> : <FileTextOutlined />}<b>{label}</b><span>{file ? 'Đã tải lên' : 'Chưa tải lên'}</span>{file && <EyeOutlined />}</button>;
        })}</div>
      </article>;
    })}</div>
    {!matches.length && <Empty image={Empty.PRESENTED_IMAGE_SIMPLE} description={profiles.length ? 'Không tìm thấy ngựa phù hợp.' : 'Chưa có ngựa trong hồ sơ.'} />}
    <footer><span>{matches.length ? `Hiển thị ${(current - 1) * 6 + 1}–${Math.min(current * 6, matches.length)} trên ${matches.length} ngựa` : '0 ngựa'}</span>{matches.length > 6 && <Pagination size="small" current={current} pageSize={6} total={matches.length} onChange={setPage} showSizeChanger={false} />}</footer>
  </section>;
}
