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
  incident: { title: 'Báo cáo sự cố', description: 'Báo ngay cho điều phối viên khi có sự cố trên đường' },
};

/** Driver/Escort dùng khung riêng (DriverShell) với 2 mục; các view cũ (assignments, milestones, horse-logs…) quy về `trip`. */
export default function DriverDashboard({ account, logout }: DashboardProps) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [search, setSearch] = useState('');
  const data = useDriverTrips();
  const requested = params.get('view');
  const view = DRIVER_NAV.some(item => item.id === requested) ? requested! : 'trip';

  useEffect(() => {
    if (requested !== view) navigate(`/dashboard?view=${view}`, { replace: true });
  }, [requested, view, navigate]);

  const go = (next: string) => navigate(`/dashboard?view=${next}`);
  const heading = view === 'incident' ? HEADINGS.incident : data.selected?.orderStatus === 'IN_TRANSIT' ? HEADINGS.running : HEADINGS.trip;

  return (
    <DriverShell
      account={account} logout={logout} view={view} onNavigate={go} crewRole={data.selected?.crewRole}
      heading={heading} search={search} onSearch={setSearch}
    >
      <DriverWorkspace data={data} view={view} search={search} onNavigate={go} />
    </DriverShell>
  );
}
