import { useCallback, useEffect, useState } from 'react';
import { Alert, Button, Empty, Spin } from 'antd';
import { ReloadOutlined } from '@ant-design/icons';
import IncidentScreen from '../driver/IncidentScreen';
import CareLogPage from './CareLogPage';
import type { DriverTrips } from '../driver/useDriverTrips';
import type { RealtimeHorseReportViewed } from '../driver/useDriverRealtime';
import { useDriverNotice } from '../driver/DriverNotices';
import '../driver/driver.css';
import './escort.css';

/** Màn hộ tống: ?view=care (E1 Quản lý ngựa) và ?view=incident (báo sự cố, mặc định Y tế ngựa). Chưa có chuyến → màn trống E0. */
export default function EscortWorkspace({ data, view, viewedEvent, onNavigate }: {
  data: DriverTrips;
  view: string;
  viewedEvent: RealtimeHorseReportViewed | null;
  onNavigate: (view: string) => void;
}) {
  const { details, active, load, loading, refreshing, error } = data;
  const notice = useDriverNotice();
  const [done, setDone] = useState('');
  const finished = useCallback((message: string) => { setDone(message); onNavigate('care'); }, [onNavigate]);

  // Thông báo gửi sự cố xong (từ trang sự cố quay về E1) hiện một lần dạng toast.
  useEffect(() => {
    if (done && view === 'care') { notice.success(done); setDone(''); }
  }, [done, view, notice]);

  if (loading) return <div className="drv-loading"><Spin size="large" /><span>Đang tải chuyến…</span></div>;

  const retry = error && (
    <Alert type="error" showIcon message={error} action={<Button size="small" onClick={() => void load()}>Thử lại</Button>} />
  );

  return (
    <div className="drv esc-root">
      {retry}
      {!error && !active ? (
        <section className="drv-card drv-empty">
          <Empty description={<>
            <strong>Bạn chưa có chuyến được phân công</strong>
            <p>Chuyến sẽ xuất hiện khi kế hoạch được duyệt và điều phối viên phân công đủ tài xế, hộ tống (đơn tự chuyển sang sẵn sàng).</p>
          </>} />
          <div className="drv-empty-actions">
            <Button type="primary" icon={<ReloadOutlined />} className="drv-btn-start" onClick={() => void load()} loading={refreshing}>Tải lại</Button>
          </div>
        </section>
      ) : active && (view === 'incident' ? (
        <IncidentScreen
          key={active.id} trip={active} detail={details[active.id]} onNavigate={onNavigate} home="care" homeLabel="Về Quản lý ngựa" onDone={finished}
        />
      ) : (
        <CareLogPage key={active.id} trip={active} detail={details[active.id]} viewedEvent={viewedEvent} onTripChanged={load} />
      ))}
    </div>
  );
}
