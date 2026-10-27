import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Spin } from 'antd';
import { CrewRole } from '@my-project/shared';
import type { DashboardProps } from '../components/DashboardLayout';
import DriverShell, { DRIVER_NAV } from '../../../tracking/driver/DriverShell';
import DriverWorkspace from '../../../tracking/driver/DriverWorkspace';
import EscortArea from '../../../tracking/escort/EscortArea';
import { useDriverTrips, type DriverTrips } from '../../../tracking/driver/useDriverTrips';
import '../../../tracking/tracking.css';

const HEADINGS: Record<string, { title: string; description: string }> = {
  trip: { title: 'Chuyến vận chuyển', description: 'Chuyến được điều phối giao cho bạn hôm nay' },
  running: { title: 'Chuyến đang chạy', description: 'Bấm Check-in mỗi khi tới một chặng' },
  history: { title: 'Lịch sử giao hàng', description: 'Các chuyến bạn đã giao' },
  incident: { title: 'Báo cáo sự cố', description: 'Tạo đơn báo cáo gửi điều phối' },
};

/**
 * Điểm vào của Driver/Escort. Khung theo vai trò trong chuyến đang hoạt động (trip_assignments.role): ESCORT → khung hộ tống (E1),
 * DRIVER → khung tài xế. Chưa có chuyến hoạt động thì theo chuyến lịch sử gần nhất, mặc định tài xế; không có bộ chọn vai trò.
 */
export default function DriverDashboard({ account, logout }: DashboardProps) {
  const data = useDriverTrips();
  const role = data.active?.crewRole ?? data.history[0]?.crewRole ?? 'DRIVER';
  // Chưa biết vai trò thì chưa vẽ khung nào, tránh nhấp nháy khung tài xế rồi đổi sang hộ tống.
  if (data.loading) return <div className="drv-loading" role="status"><Spin size="large" /><span>Đang tải chuyến…</span></div>;
  return role === 'ESCORT' ? <EscortArea account={account} logout={logout} data={data} /> : <DriverArea account={account} logout={logout} data={data} />;
}

/** Driver/Escort dùng khung riêng (DriverShell) với 3 mục; các view cũ (assignments, milestones, horse-logs…) quy về `trip`. */
function DriverArea({ account, logout, data: all }: DashboardProps & { data: DriverTrips }) {
  // Lịch sử giao hàng của tài xế chỉ gồm chuyến làm DRIVER; chuyến làm hộ tống nằm ở khung hộ tống.
  const data = { ...all, history: all.historyFor(CrewRole.DRIVER) };
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const requested = params.get('view');
  const view = DRIVER_NAV.some(item => item.id === requested) ? requested! : 'trip';
  const tripId = view === 'history' ? params.get('trip') : null;

  useEffect(() => {
    if (requested !== view) navigate(`/dashboard?view=${view}`, { replace: true });
  }, [requested, view, navigate]);

  const go = (next: string, trip?: string) => {
    setSearch('');
    navigate(`/dashboard?view=${next}${trip ? `&trip=${encodeURIComponent(trip)}` : ''}`);
  };
  const heading = view === 'incident'
    ? { ...HEADINGS.incident, description: HEADINGS.incident.description + (data.selected ? ` · chuyến ${data.selected.orderCode}` : '') }
    : view === 'history' ? HEADINGS.history
    : data.selected?.orderStatus === 'IN_TRANSIT' ? HEADINGS.running : HEADINGS.trip;

  return (
    <DriverShell
      account={account} logout={logout} view={view} onNavigate={go} crewRole={data.selected?.crewRole ?? data.history[0]?.crewRole}
      heading={heading} search={search} onSearch={setSearch} activeTripId={data.active?.id ?? null}
      searchPlaceholder={view === 'history' && !tripId ? 'Tìm mã đơn, khách hàng, tuyến…' : undefined}
    >
      <DriverWorkspace data={data} userId={String(account.id)} view={view} historyTripId={tripId} search={search} onNavigate={go} />
    </DriverShell>
  );
}
