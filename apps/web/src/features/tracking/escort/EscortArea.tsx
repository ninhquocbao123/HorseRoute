import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { CrewRole, type IUser } from '@my-project/shared';
import DriverShell, { ESCORT_NAV } from '../driver/DriverShell';
import type { DriverTrips } from '../driver/useDriverTrips';
import type { RealtimeHorseReportViewed } from '../driver/useDriverRealtime';
import EscortWorkspace from './EscortWorkspace';

const HEADINGS: Record<string, { title: string; description: string }> = {
  care: { title: 'Quản lý ngựa', description: 'Nhật ký cho ăn, uống nước và nghỉ chân' },
  history: { title: 'Lịch sử hộ tống', description: 'Các chuyến bạn đã làm hộ tống' },
  incident: { title: 'Báo sự cố', description: 'Tạo đơn báo cáo gửi điều phối' },
};

/** Khung hộ tống: 3 view `care` (E1), `history` (chỉ xem) và `incident`; view khác (kể cả của tài xế) quy về `care`. */
export default function EscortArea({ account, logout, data: all }: { account: IUser; logout: () => void; data: DriverTrips }) {
  // Lịch sử hộ tống chỉ gồm chuyến làm ESCORT; chuyến làm tài xế nằm ở khung tài xế.
  const data = { ...all, history: all.historyFor(CrewRole.ESCORT) };
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [viewed, setViewed] = useState<RealtimeHorseReportViewed | null>(null);
  const [search, setSearch] = useState('');
  const requested = params.get('view');
  const view = requested === 'incident' || requested === 'history' ? requested : 'care';
  const tripId = view === 'history' ? params.get('trip') : null;

  useEffect(() => {
    if (requested !== view) navigate(`/dashboard?view=${view}`, { replace: true });
  }, [requested, view, navigate]);

  const go = (next: string, trip?: string) => {
    setSearch('');
    navigate(`/dashboard?view=${next}${trip ? `&trip=${encodeURIComponent(trip)}` : ''}`);
  };
  const base = HEADINGS[view];
  const heading = view === 'history' ? base : { ...base, description: base.description + (data.active ? ` · chuyến ${data.active.orderCode}` : '') };

  return (
    <DriverShell
      account={account} logout={logout} view={view} onNavigate={go} crewRole={CrewRole.ESCORT} nav={ESCORT_NAV}
      heading={heading} search={search} onSearch={setSearch} activeTripId={data.active?.id ?? null}
      searchPlaceholder={view === 'history' && !tripId ? 'Tìm mã đơn, khách hàng, tuyến…' : undefined}
      onHorseReportViewed={setViewed} showDescription
      topbarAction={(
        <Button
          className="drs-tool esc-incident-btn" danger icon={<WarningOutlined />} disabled={!data.active || view === 'incident'} onClick={() => go('incident')}
          title={data.active ? undefined : 'Chỉ báo sự cố khi có chuyến đang hoạt động.'}
        >
          Báo sự cố
        </Button>
      )}
    >
      <EscortWorkspace data={data} view={view} historyTripId={tripId} search={search} viewedEvent={viewed} onNavigate={go} />
    </DriverShell>
  );
}
