import { useState } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Button, Input, InputNumber, Modal, Space } from 'antd';
import { api } from '../../lib/axios';

export type CancelResult = { id: string; status: 'CANCELLED'; paid: number; refund: number };
const money = (n: number) => n.toLocaleString('vi-VN') + ' đ';

/**
 * A4 - Hủy đơn. Khách: đơn chờ duyệt hoặc cần bổ sung, lý do không bắt buộc.
 * Quản lý: tới trước khi xe xuất phát, lý do bắt buộc; khách đã trả tiền thì nhập số hoàn (0 nếu không hoàn).
 */
export default function CancelOrderDialog({ orderId, orderCode, manager = false, paid = 0, onClose, onDone }: {
  orderId: string; orderCode: string; manager?: boolean; paid?: number; onClose: () => void; onDone: (result: CancelResult) => void;
}) {
  const [reason, setReason] = useState('');
  const [refund, setRefund] = useState<number | null>(paid > 0 ? null : 0);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const needRefund = manager && paid > 0;
  const ready = (!manager || reason.trim().length >= 5) && (!needRefund || (refund !== null && refund >= 0 && refund <= paid));
  async function submit() {
    setBusy(true); setError('');
    try {
      const body = { ...(reason.trim() ? { reason: reason.trim() } : {}), ...(needRefund ? { refundAmount: refund ?? 0 } : {}) };
      onDone((await api.post<CancelResult>(`/orders/${encodeURIComponent(orderId)}/cancel`, body)).data);
    } catch (e) {
      const data = isAxiosError(e) ? e.response?.data as { message?: string; fields?: Record<string, string> } | undefined : undefined;
      setError(data?.fields ? Object.values(data.fields).join(' ') : data?.message || 'Chưa hủy được đơn. Vui lòng thử lại.');
    } finally { setBusy(false); }
  }
  return (
    <Modal open title={`Hủy đơn ${orderCode}`} centered destroyOnHidden onCancel={() => { if (!busy) onClose(); }}
      okText="Hủy đơn" cancelText="Quay lại" okButtonProps={{ danger: true, disabled: !ready, loading: busy }} cancelButtonProps={{ disabled: busy }} onOk={() => void submit()}>
      <p>{manager
        ? 'Đơn chuyển sang Đã hủy, xe và tổ lái đã giữ được trả lại, khách và tổ lái nhận thông báo. Không hoàn tác được.'
        : 'Quản lý sẽ nhận thông báo. Đơn đã hủy không mở lại được; muốn đi chuyến khác thì đặt đơn mới.'}</p>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 12 }} />}
      <label htmlFor="cancel-reason">{manager ? 'Lý do hủy (bắt buộc)' : 'Lý do hủy (không bắt buộc)'}</label>
      <Input.TextArea id="cancel-reason" rows={3} maxLength={255} showCount value={reason} disabled={busy} onChange={e => setReason(e.target.value)}
        placeholder={manager ? 'Ví dụ: khách hủy vì ngựa bị bệnh, hoàn 70% tiền cọc' : 'Ví dụ: đổi lịch thi đấu'} />
      {needRefund && <div style={{ marginTop: 16 }}>
        <label htmlFor="cancel-refund">Số tiền hoàn cho khách (đã thu {money(paid)})</label>
        <Space wrap style={{ display: 'flex', marginTop: 6 }}>
          <InputNumber id="cancel-refund" min={0} max={paid} step={100000} value={refund} disabled={busy} style={{ width: 200 }}
            formatter={v => v === undefined || v === null ? '' : Number(v).toLocaleString('vi-VN')} parser={v => Number(String(v ?? '').replace(/\D/g, ''))}
            onChange={v => setRefund(typeof v === 'number' ? v : null)} addonAfter="đ" />
          {[0, 0.5, 1].map(rate => <Button key={rate} size="small" disabled={busy} onClick={() => setRefund(Math.round(paid * rate))}>{rate === 0 ? 'Không hoàn' : rate === 1 ? 'Hoàn toàn bộ' : 'Hoàn 50%'}</Button>)}
        </Space>
      </div>}
    </Modal>
  );
}
