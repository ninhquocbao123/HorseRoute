import { useState } from 'react';
import { Alert, App, Button, Input, Select } from 'antd';
import { FileProtectOutlined } from '@ant-design/icons';
import { api } from '../../lib/axios';
import { errorMessage } from '../tracking/tracking.api';
import { gatesTo, type CustomsValue } from '../customer/CustomsFields';
import './order-customs.css';

/** Trạng thái đơn còn bổ sung được thông quan (khớp CUSTOMS_EDITABLE ở API). */
const EDITABLE = ['PENDING', 'APPROVED', 'PREPARING', 'READY', 'IN_TRANSIT'];
const text = (value: unknown) => typeof value === 'string' ? value : '';
export const customsFrom = (booking: unknown): CustomsValue => {
  let data: Record<string, unknown> = {};
  try { data = (typeof booking === 'string' ? JSON.parse(booking) : booking ?? {}) as Record<string, unknown>; } catch { /* booking hỏng: coi như trống */ }
  return { customsCode: text(data.customsCode), importPermit: text(data.importPermit), border: text(data.border) };
};

/**
 * B13: thông tin thông quan của chuyến quốc tế ở chi tiết đơn (khách, chuyên viên). Chuyến trong nước không hiện.
 * Bổ sung được từ khi gửi đơn tới khi xe đang chạy; thiếu số tờ khai thì quản lý chưa chuyển chuyến cho tài xế.
 */
export default function OrderCustomsCard({ order, onSaved, className }: {
  order: { id: string | number; status: string; origin_country?: string | null; destination_country?: string | null; booking_details?: unknown };
  onSaved?: () => void; className?: string;
}) {
  const { message } = App.useApp();
  const saved = customsFrom(order.booking_details);
  const [editing, setEditing] = useState(false), [value, setValue] = useState(saved), [busy, setBusy] = useState(false), [error, setError] = useState('');
  const origin = order.origin_country ?? '', destination = order.destination_country ?? '';
  if (!origin || !destination || origin === destination) return null;
  const foreign = destination !== 'VN' ? destination : origin;
  const gates = gatesTo(foreign);
  const canEdit = EDITABLE.includes(order.status);
  async function save() {
    setBusy(true); setError('');
    try {
      await api.put(`/orders/${order.id}/customs`, { customsCode: value.customsCode.trim(), importPermit: value.importPermit.trim(), border: value.border.trim() });
      setEditing(false);
      void message.success('Đã lưu thông tin thông quan.');
      onSaved?.();
    } catch (failure) { setError(errorMessage(failure)); } finally { setBusy(false); }
  }
  const show = (label: string, current: string, missing: string) => <p><span>{label}: </span><strong>{current || missing}</strong></p>;
  return (
    <section className={className ?? 'order-customs'} aria-label="Thông quan">
      <h3><FileProtectOutlined /> Thông quan</h3>
      {!editing ? <>
        {show('Số tờ khai hải quan', saved.customsCode, 'Chưa có')}
        {show('Giấy phép nhập khẩu', saved.importPermit, 'Chưa có')}
        {show('Cửa khẩu dự kiến', saved.border, 'Để điều phối chọn')}
        {!saved.customsCode && canEdit && <Alert type="warning" showIcon title="Chưa có số tờ khai hải quan" description="Bổ sung khi có tờ khai (thường sau khi có giấy kiểm dịch). Thiếu số tờ khai thì quản lý chưa chuyển chuyến cho tài xế." />}
        {canEdit && <Button onClick={() => { setValue(saved); setEditing(true); }}>{saved.customsCode ? 'Sửa thông tin thông quan' : 'Bổ sung thông tin thông quan'}</Button>}
      </> : <div className="order-customs-form">
        <label>Số tờ khai hải quan<Input aria-label="Số tờ khai hải quan" value={value.customsCode} maxLength={80} onChange={e => setValue({ ...value, customsCode: e.target.value })} /></label>
        <label>Số giấy phép nhập khẩu<Input aria-label="Số giấy phép nhập khẩu" value={value.importPermit} maxLength={80} onChange={e => setValue({ ...value, importPermit: e.target.value })} /></label>
        <label>Cửa khẩu dự kiến<Select aria-label="Cửa khẩu dự kiến" value={value.border} onChange={border => setValue({ ...value, border })}
          options={[{ value: '', label: 'Để điều phối chọn' }, ...[...new Set([...gates, ...(value.border ? [value.border] : [])])].map(g => ({ value: g, label: g }))]} /></label>
        {error && <Alert type="error" showIcon title={error} />}
        <div className="order-customs-actions">
          <Button disabled={busy} onClick={() => { setEditing(false); setError(''); }}>Hủy</Button>
          <Button type="primary" loading={busy} onClick={() => void save()}>Lưu</Button>
        </div>
      </div>}
    </section>
  );
}
