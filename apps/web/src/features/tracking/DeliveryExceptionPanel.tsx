import { useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import { Alert, Button, DatePicker, Input } from 'antd';
import type { Dayjs } from 'dayjs';
import type { IDeliveryClearance } from '@my-project/shared';
import { errorMessage, trackingApi } from './tracking.api';
import { formatDateTime } from './tracking.format';

/**
 * Ngoại lệ giao ngựa khi còn nợ (kế hoạch 10, mục 7): Quản lý duyệt, rồi Điều phối mở cho tài xế.
 * Tài xế vẫn tự bấm giao nên giờ giao đúng thực tế; đơn còn nợ vẫn hiện ở công nợ của Quản lý.
 */
export default function DeliveryExceptionPanel({ orderId, canApprove }: { orderId: string; canApprove: boolean }) {
  const [data, setData] = useState<IDeliveryClearance | null>(null);
  const [reason, setReason] = useState('');
  const [dueAt, setDueAt] = useState<Dayjs | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      setData(await trackingApi.deliveryClearance(orderId));
      setError('');
    } catch (e) {
      // Đơn chưa có chuyến đã duyệt thì chưa có gì để xử lý.
      if (isAxiosError(e) && e.response?.status === 404) setData(null);
      else setError(errorMessage(e));
    }
  }, [orderId]);
  useEffect(() => { void load(); }, [load]);

  async function run(action: () => Promise<IDeliveryClearance>) {
    setBusy(true);
    setError('');
    try {
      setData(await action());
    } catch (e) {
      setError(errorMessage(e));
      void load();
    } finally {
      setBusy(false);
    }
  }

  if (!data && !error) return null;
  const exception = data?.exception;
  return (
    <section className="coord-inc-block" style={{ marginTop: 12 }}>
      <h3>Ngoại lệ giao ngựa</h3>
      {error && <Alert type="error" showIcon title={error} style={{ marginBottom: 8 }} />}
      {data?.fullyPaid && <p>Đơn đã thanh toán đủ, tài xế xác nhận giao được.</p>}
      {data && !data.fullyPaid && !exception && (canApprove ? (
        <div style={{ display: 'grid', gap: 8 }}>
          <p>Đơn còn nợ nên tài xế chưa xác nhận giao được. Chỉ duyệt khi đã thống nhất với khách.</p>
          <Input.TextArea aria-label="Lý do cho giao khi còn nợ" rows={2} maxLength={500} value={reason} placeholder="Lý do và cách thu phần còn nợ" onChange={e => setReason(e.target.value)} />
          <DatePicker aria-label="Hạn trả" showTime placeholder="Hạn trả (không bắt buộc)" value={dueAt} onChange={setDueAt} />
          <Button
            type="primary" loading={busy} disabled={reason.trim().length < 5} style={{ justifySelf: 'start' }}
            onClick={() => void run(() => trackingApi.approveDeliveryException(orderId, { reason: reason.trim(), dueAt: dueAt ? dueAt.toISOString() : null }))}
          >
            Duyệt giao khi còn nợ
          </Button>
        </div>
      ) : (
        <p>Khách chưa thanh toán đủ. Việc cho giao khi còn nợ cần Quản lý duyệt; hãy liên hệ Quản lý.</p>
      ))}
      {data && !data.fullyPaid && exception && (
        <>
          <p>Quản lý {exception.approvedByName} duyệt lúc {formatDateTime(exception.approvedAt)}: {exception.reason}</p>
          {exception.dueAt && <p>Hạn trả: {formatDateTime(exception.dueAt)}</p>}
          {exception.status === 'OPENED' ? (
            <p>Đã mở cho tài xế bởi {exception.openedByName} lúc {formatDateTime(exception.openedAt)}.</p>
          ) : (
            <Button type="primary" loading={busy} onClick={() => void run(() => trackingApi.openDeliveryException(orderId))}>Mở cho tài xế giao</Button>
          )}
        </>
      )}
    </section>
  );
}
