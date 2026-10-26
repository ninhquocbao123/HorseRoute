import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Button } from 'antd';
import { WarningOutlined } from '@ant-design/icons';
import { CrewRole, type IUser } from '@my-project/shared';
import DriverShell, { ESCORT_NAV } from '../driver/DriverShell';
import type { DriverTrips } from '../driver/useDriverTrips';
import type { RealtimeHorseReportViewed } from '../driver/useDriverRealtime';
import EscortWorkspace from './EscortWorkspace';

const HEADINGS = {
  care: { title: 'Quản lý ngựa', description: 'Nhật ký cho ăn, uống nước và nghỉ chân' },
  incident: { title: 'Báo sự cố', description: 'Tạo đơn báo cáo gửi điều phối' },
};

/** Khung hộ tống (Figma E1): chỉ 2 view `care` và `incident`; view khác (kể cả của tài xế) quy về `care`. */
export default function EscortArea({ account, logout, data }: { account: IUser; logout: () => void; data: DriverTrips }) {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [viewed, setViewed] = useState<RealtimeHorseReportViewed | null>(null);
  const requested = params.get('view');
  const view = requested === 'incident' ? 'incident' : 'care';

  useEffect(() => {
    if (requested !== view) navigate(`/dashboard?view=${view}`, { replace: true });
  }, [requested, view, navigate]);

  const go = (next: string) => navigate(`/dashboard?view=${next}`);
  const heading = view === 'incident'
    ? { ...HEADINGS.incident, description: HEADINGS.incident.description + (data.active ? ` · chuyến ${data.active.orderCode}` : '') }
    : { ...HEADINGS.care, description: HEADINGS.care.description + (data.active ? ` · chuyến ${data.active.orderCode}` : '') };

  return (
    <DriverShell
      account={account} logout={logout} view={view} onNavigate={go} crewRole={CrewRole.ESCORT} nav={ESCORT_NAV}
      heading={heading} search="" onSearch={() => undefined} activeTripId={data.active?.id ?? null}
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
      <EscortWorkspace data={data} view={view} viewedEvent={viewed} onNavigate={go} />
    </DriverShell>
  );
}
