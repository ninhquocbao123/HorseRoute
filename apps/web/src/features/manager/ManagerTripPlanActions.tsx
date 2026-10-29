import { useState } from 'react';
import { createPortal } from 'react-dom';
import { Alert, App, Button, Card, Input, Modal, Space, Spin } from 'antd';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../lib/axios';
import { getTripAssignments, getTripDetail, reviewTripPlan } from '../../modules/trips/api/trips.api';
import { RouteMap } from '../../modules/coordinator/maps/RouteMap';
import { errorMessage } from '../tracking/tracking.api';
import './manager-trip-plan.css';

type Readiness = { valid: boolean; canStart: boolean; blockers: { code: string; message: string }[] };
const formatTime = (value: string | null) => value ? new Date(value).toLocaleString('vi-VN', { timeZone: 'Asia/Ho_Chi_Minh' }) : 'Chưa có';
const hiddenReadinessMessages = new Set([
  'Chỉ kiểm tra kế hoạch chờ duyệt hoặc đã duyệt của đơn đang chuẩn bị.',
]);

export default function ManagerTripPlanActions({ tripId, onUpdated, contentTarget }: { tripId: string; onUpdated: () => void; contentTarget: HTMLElement | null }) {
  const [reject, setReject] = useState(false), [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const { message } = App.useApp(), qc = useQueryClient();
  const detail = useQuery({ queryKey: ['manager-trip-plan', tripId], queryFn: ({ signal }) => getTripDetail(tripId, signal) });
  const trip = detail.data;
  const assignments = useQuery({ queryKey: ['manager-trip-crew', tripId], queryFn: ({ signal }) => getTripAssignments(tripId, signal), enabled: !!contentTarget });
  const readiness = useQuery({ queryKey: ['manager-trip-readiness', tripId],
    queryFn: async ({ signal }) => (await api.get<Readiness>(`/trips/${tripId}/readiness`, { signal })).data,
    enabled: !!trip && trip.orderStatus === 'PREPARING' && ['PENDING_APPROVAL', 'APPROVED'].includes(trip.planStatus) });
  const visibleReadinessBlockers = readiness.data?.blockers.filter(blocker => !hiddenReadinessMessages.has(blocker.message)) ?? [];
  async function act(action: 'APPROVED' | 'RETURNED' | 'START') {
    if (busy) return;
    setBusy(true); setError('');
    try {
      if (action === 'START') {
        const { data } = await api.get<Readiness>(`/trips/${tripId}/readiness`);
        if (!data.canStart) { setError(data.blockers.map(b => b.message).join(' ') || 'Trạng thái chuyến đã thay đổi.'); await detail.refetch(); return; }
        await api.post(`/trips/${tripId}/start-transport`, {});
      } else {
        await reviewTripPlan(tripId, action === 'APPROVED' ? { decision: action } : { decision: action, reason: reason.trim() });
      }
      setReject(false); setReason('');
      await qc.invalidateQueries({ queryKey: ['manager-trip-plan', tripId] });
      await qc.invalidateQueries({ queryKey: ['manager-trip-readiness', tripId] });
      void qc.invalidateQueries({ queryKey: ['trips'] });
      onUpdated();
      void message.success(action === 'START' ? 'Đã chuyển chuyến cho tài xế. Tài xế sẽ xác nhận khi xuất phát.' : action === 'APPROVED' ? 'Đã duyệt kế hoạch. Bạn có thể kiểm tra và chuyển chuyến cho tài xế.' : 'Đã trả kế hoạch cho Coordinator chỉnh sửa.');
    } catch (failure) { setError(errorMessage(failure)); void detail.refetch(); void readiness.refetch(); }
    finally { setBusy(false); }
  }
  const route = trip?.routePlan;
  return <>
    {error && <Alert style={{ width: '100%' }} type="error" showIcon title={error} />}
    {detail.isError && <Alert type="error" title="Không tải được kế hoạch" action={<Button onClick={() => void detail.refetch()}>Thử lại</Button>} />}
    {trip?.planStatus === 'PENDING_APPROVAL' && trip.orderStatus === 'PREPARING' && <>
      <Button danger disabled={busy} onClick={() => setReject(true)}>Từ chối</Button>
      <Button type="primary" loading={busy} onClick={() => void act('APPROVED')}>Duyệt đơn</Button>
    </>}
    {trip?.planStatus === 'APPROVED' && trip.orderStatus === 'PREPARING' && <Button type="primary" loading={busy} onClick={() => void act('START')}>Bắt đầu vận chuyển</Button>}
    <Modal title="Từ chối kế hoạch vận chuyển" open={reject} onCancel={() => !busy && setReject(false)} closable={!busy} maskClosable={!busy}
      okText="Từ chối và trả lại" cancelText="Hủy" confirmLoading={busy} cancelButtonProps={{ disabled: busy }} okButtonProps={{ danger: true, disabled: !reason.trim() }} onOk={() => void act('RETURNED')}>
      <p>Kế hoạch được trả về Coordinator để chỉnh sửa. Đơn hàng vẫn được giữ lại.</p>
      <Input.TextArea aria-label="Lý do từ chối" value={reason} onChange={e => setReason(e.target.value)} maxLength={255} rows={4} placeholder="Nhập lý do từ chối" />
      {error && <Alert type="error" title={error} />}
    </Modal>
    {contentTarget && createPortal(<div className="ois-proposed-route">
      <Spin spinning={detail.isPending || assignments.isPending}>
        <Space orientation="vertical" size="middle" style={{ width: '100%' }}>
          {readiness.isFetching && <p>Đang kiểm tra điều kiện và xung đột lịch…</p>}
          {readiness.isError && <Alert type="error" title="Chưa kiểm tra được điều kiện kế hoạch" action={<Button onClick={() => void readiness.refetch()}>Thử lại</Button>} />}
          {visibleReadinessBlockers.map((b, i) => <Alert key={i} type="warning" showIcon title={b.message} />)}
          {readiness.data?.valid && <Alert className="mgr-plan-valid-alert" type="success" showIcon title="Kế hoạch hợp lệ tại thời điểm kiểm tra. Hệ thống sẽ kiểm tra lại khi duyệt hoặc chuyển chuyến." />}
          {route ? <>
            <div className="coordinator-scope"><RouteMap readOnly geometry={route.selectedRoute?.geometry} waypoints={route.waypoints.map(p => ({ id: p.id, label: p.label, kind: p.kind === 'ORIGIN' ? 'origin' : p.kind === 'DESTINATION' ? 'destination' : 'stop', position: [p.latitude, p.longitude] }))} /></div>
            <ol>{route.waypoints.map(p => <li key={p.id} style={{ marginBottom: 12 }}><strong>{p.kind === 'ORIGIN' ? 'Điểm gửi' : p.kind === 'DESTINATION' ? 'Điểm nhận' : 'Điểm nghỉ'}: </strong>{p.label}{p.note && <div>Ghi chú: {p.note}</div>}</li>)}</ol>
            <p><strong>Tổng quãng đường: </strong>{route.selectedRoute ? `${(route.selectedRoute.distanceM / 1000).toLocaleString('vi-VN')} km` : 'Chưa chọn tuyến'}<br />
              <strong>Thời gian lái xe dự kiến: </strong>{route.selectedRoute ? `${Math.floor(route.selectedRoute.durationS / 3600)} giờ ${Math.round(route.selectedRoute.durationS % 3600 / 60)} phút` : 'Chưa có'}</p>
          </> : <Alert type="warning" title="Chưa có lộ trình bản đồ đã lưu." />}
          <p><strong>Khởi hành: </strong>{formatTime(trip?.plannedDepartureAt ?? null)}<br /><strong>Đến nơi: </strong>{formatTime(trip?.plannedArrivalAt ?? null)}<br />Giờ Việt Nam (UTC+7).</p>
          {assignments.isError && <Alert type="error" title="Không tải được phân công" action={<Button onClick={() => void assignments.refetch()}>Thử lại</Button>} />}
          {assignments.data?.crewReadiness.blockers.map((b, i) => <Alert key={i} type="warning" title={b.message} />)}
          {assignments.data?.vehicles?.map(v => <Card key={v.id} title={`Xe ${v.plateNumber} · ${v.horseCount ?? 0}/${v.capacityStalls} ngựa`}>
            <p>Tài xế: {v.crew.filter(p => p.role === 'DRIVER').map(p => p.fullName).join(', ') || 'Chưa phân công'}</p>
            <p>Lơ xe (hộ tống): {v.crew.filter(p => p.role === 'ESCORT').map(p => p.fullName).join(', ') || 'Chưa phân công'}</p>
          </Card>)}
        </Space>
      </Spin>
    </div>, contentTarget)}
  </>;
}
