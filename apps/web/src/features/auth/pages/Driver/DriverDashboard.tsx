import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import type { DashboardProps } from '../components/DashboardLayout';
import DriverShell, { DRIVER_NAV } from '../../../tracking/driver/DriverShell';
import DriverWorkspace from '../../../tracking/driver/DriverWorkspace';
import { useDriverTrips } from '../../../tracking/driver/useDriverTrips';
import '../../../tracking/tracking.css';

const HEADINGS: Record<string, { title: string; description: string }> = {
  trip: { title: 'Chuyến vận chuyển', description: 'Chuyến được điều phối giao cho bạn hôm nay' },
  running: { title: 'Chuyến đang chạy', description: 'Bấm Check-in mỗi khi tới một chặng' },
  history: { title: 'Lịch sử giao hàng', description: 'Các chuyến bạn đã giao' },
  incident: { title: 'Báo cáo sự cố', description: 'Tạo đơn báo cáo gửi điều phối' },
};

/** Driver/Escort dùng khung riêng (DriverShell) với 3 mục; các view cũ (assignments, milestones, horse-logs…) quy về `trip`. */
export default function DriverDashboard({ account, logout }: DashboardProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const data = useDriverTrips();
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
