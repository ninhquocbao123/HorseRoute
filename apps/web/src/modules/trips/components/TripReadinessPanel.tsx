import { isAxiosError } from 'axios';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { App, Modal } from 'antd';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { markOrderReady } from '../api/trips.api';
import { tripQueryKeys } from '../constants/trip-query-keys';
import { useTripReadinessQuery } from '../hooks/use-trip-readiness-query';
import type { ReadinessBlocker, TripDetail, TripReadiness } from '../types/trip.types';
import ReadinessBlockerList from './ReadinessBlockerList';

export default function TripReadinessPanel({ trip }: { trip: TripDetail }) {
  const { account } = useAuth();
  const { message: messageApi } = App.useApp();
  const queryClient = useQueryClient();
  const query = useTripReadinessQuery(trip.id);
  const [resultOverride, setResultOverride] = useState<TripReadiness | null>(null);
  const [marking, setMarking] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const result = resultOverride ?? query.data;
  const alreadyReady = trip.orderStatus === 'READY' || result?.orderStatus === 'READY';
  const canMark = account?.role === 'MANAGER' && !alreadyReady && !!result?.eligibleForReady && ['APPROVED', 'PREPARING'].includes(result.orderStatus);

  async function handleMarkReady() {
    if (!result || !canMark) return;
    setMarking(true);
    try {
      const saved = await markOrderReady(result.orderId);
      queryClient.setQueryData(tripQueryKeys.detail(account?.id, trip.id), { ...trip, orderStatus: saved.orderStatus, planStatus: saved.planStatus });
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['trips', account?.id, 'list'] }),
        queryClient.invalidateQueries({ queryKey: tripQueryKeys.readiness(account?.id, trip.id) }),
      ]);
      setResultOverride({ ...result, orderStatus: saved.orderStatus, planStatus: saved.planStatus, eligibleForReady: false, blockers: [] });
      void messageApi.success({ key: 'trip-readiness-feedback', content: 'Đã xác nhận READY. Đơn đã hoàn tất chuẩn bị.' });
    } catch (cause) {
      if (isAxiosError(cause) && cause.response?.status === 409) {
        const blockers = (cause.response.data?.blockers ?? []) as ReadinessBlocker[];
        setResultOverride({ ...result, eligibleForReady: false, blockers });
        void messageApi.warning({ key: 'trip-readiness-feedback', content: 'Điều kiện đã thay đổi. Đã cập nhật lại danh sách blocker từ backend.', duration: 5 });
      } else {
        void messageApi.error({ key: 'trip-readiness-feedback', content: String(isAxiosError(cause) ? (cause.response?.data?.message || 'Không thể xác nhận READY.') : 'Không thể xác nhận READY.'), duration: 5 });
      }
    } finally { setMarking(false); }
  }

  if (query.isPending) return <div className="trip-readiness-state" role="status"><h2>Kiểm tra điều kiện</h2><p>Đang kiểm tra điều kiện sẵn sàng từ backend…</p></div>;
  if (query.isError && !result) return <div className="trip-readiness-state is-error" role="alert"><h2>Không thể kiểm tra điều kiện</h2><p>Chưa có kết quả hợp lệ. Vui lòng thử lại.</p><button type="button" onClick={() => void query.refetch()} disabled={query.isFetching}>Kiểm tra lại</button></div>;
  if (!result) return null;
  return <div className="trip-readiness-panel">
    <div className="trip-readiness-head"><div><h2>Điều kiện sẵn sàng vận chuyển</h2><p>Kiểm tra theo đơn {result.orderId}; kết quả hiện tại từ backend.</p></div><button type="button" onClick={() => { setResultOverride(null); void query.refetch(); }} disabled={query.isFetching || marking}>Kiểm tra lại</button></div>
    {alreadyReady ? <div className="trip-readiness-complete" role="status"><strong>Đơn đã READY.</strong><span>Bước chuẩn bị đã hoàn tất; không thể xác nhận READY lần hai.</span></div> : <div className={`trip-readiness-result ${result.eligibleForReady ? 'is-ready' : 'is-blocked'}`}><strong>{result.eligibleForReady ? 'Đủ điều kiện xác nhận READY' : 'Chưa đủ điều kiện READY'}</strong><span>{result.blockers.length ? `${result.blockers.length} blocker cần xử lý.` : 'Backend không trả về blocker.'}</span></div>}
    {!alreadyReady && <ReadinessBlockerList blockers={result.blockers} />}
    {canMark && <div className="trip-readiness-actions"><button className="trip-action-button" type="button" onClick={() => setConfirmOpen(true)} disabled={marking}>Xác nhận READY</button></div>}
    {account?.role !== 'MANAGER' && <p className="trip-readiness-note">Chỉ Manager có quyền xác nhận READY.</p>}
    <Modal open={confirmOpen} centered title="Xác nhận READY" okText="Xác nhận" cancelText="Hủy" confirmLoading={marking} maskClosable={false} onCancel={() => setConfirmOpen(false)} onOk={() => { setConfirmOpen(false); void handleMarkReady(); }}>
      <p>Backend sẽ chuyển đơn <strong>{result.orderId}</strong> sang READY. Sau bước này không thể mở lại kế hoạch đã được duyệt.</p>
    </Modal>
  </div>;
}
