import AccountProfile from '../../../components/AccountProfile';
import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Badge, Button, Drawer, Input } from 'antd';
import { BellOutlined, CalendarOutlined, HistoryOutlined, LogoutOutlined, ReloadOutlined, SearchOutlined, TruckOutlined, WarningOutlined } from '@ant-design/icons';
import type { CrewRole, IUser } from '@my-project/shared';
import LogoutDialog from '../../auth/pages/components/LogoutDialog';
import NotificationsPanel from '../../notifications/NotificationsPanel';
import { useNotifications } from '../../notifications/useNotifications';
import { DriverNoticeProvider, useDriverNotice } from './DriverNotices';
import { OpenAlertsList } from './OpenAlertsList';
import { useAlertToasts } from './useAlertToasts';
import { useDriverRealtime, type RealtimeHorseReportViewed } from './useDriverRealtime';
import { FeedIcon } from './icons';
import './driver-shell.css';

export type NavItem = { id: string; title: string; icon: ReactNode };

export const DRIVER_NAV: NavItem[] = [
  { id: 'trip', title: 'Chuyến vận chuyển', icon: <TruckOutlined /> },
  { id: 'history', title: 'Lịch sử giao hàng', icon: <HistoryOutlined /> },
  { id: 'incident', title: 'Báo cáo sự cố', icon: <WarningOutlined /> },
];

/** Hộ tống (Figma E1/E2): Quản lý ngựa + Lịch sử hộ tống (E2 thêm ở bước sau); báo sự cố là nút nhỏ trên topbar. */
export const ESCORT_NAV: NavItem[] = [
  { id: 'care', title: 'Quản lý ngựa', icon: <FeedIcon /> },
  { id: 'history', title: 'Lịch sử hộ tống', icon: <HistoryOutlined /> },
];

/** Màu viền trái của thông báo chưa đọc theo loại: cảnh báo điều phối vàng, còn lại trung tính. */
const accentOf = (notice: { event_type?: string }) => (notice.event_type === 'TRIP_ALERT' ? '#ca8a04' : '#9aa8a1');

const ROLE_LABEL: Record<CrewRole, string> = { DRIVER: 'Tài xế', ESCORT: 'Hộ tống' };
const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Khung riêng của Driver/Escort (Figma D1/D1b/E1): sidebar theo `nav`, topbar có tìm kiếm (tùy chọn), chuông và ngày hôm nay. */
export default function DriverShell(props: ShellProps) {
  return <DriverNoticeProvider><DriverShellInner {...props} /></DriverNoticeProvider>;
}

type ShellProps = {
  account: IUser;
  logout: () => void;
  view: string;
  onNavigate: (view: string) => void;
  /** Vai trò trong chuyến đang chọn; chưa có chuyến thì hiện "Tài xế". */
  crewRole: CrewRole | undefined;
  heading: { title: string; description: string };
  search: string;
  onSearch: (value: string) => void;
  /** Có thì hiện ô tìm kiếm (chỉ ở Lịch sử giao hàng); không có thì ẩn */
  searchPlaceholder?: string;
  /** Chuyến đang hoạt động (nhận cảnh báo điều phối); null khi chưa có. */
  activeTripId?: string | null;
  /** Mục sidebar; mặc định của tài xế. */
  nav?: NavItem[];
  /** Hiện dòng mô tả dưới tiêu đề (Figma E1); mặc định ẩn như D1/D1b */
  showDescription?: boolean;
  /** Nút ở topbar, trước chuông (hộ tống: "Báo sự cố"). */
  topbarAction?: ReactNode;
  /** Hộ tống: khách vừa mở một báo cáo sức khỏe (socket). */
  onHorseReportViewed?: (payload: RealtimeHorseReportViewed) => void;
  children: ReactNode;
};

function DriverShellInner({ account, logout, view, onNavigate, crewRole, heading, search, onSearch, searchPlaceholder, activeTripId = null, nav = DRIVER_NAV, topbarAction, showDescription = false, onHorseReportViewed, children }: ShellProps) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const { panelProps, unreadCount, addNotice, refresh, markReadQuiet } = useNotifications(String(account.id));
  const notice = useDriverNotice();
  const [alertsListOpen, setAlertsListOpen] = useState(false);
  const alerts = useAlertToasts(String(account.id), activeTripId, notice, () => { setAlertsListOpen(true); setBellOpen(true); }, {
    markRead: id => void markReadQuiet(id),
    openPanel: () => { setAlertsListOpen(false); setBellOpen(true); },
  });
  // Thông báo đọc ở bảng chuông thì toast tương ứng biến mất.
  const { sync } = alerts;
  const readIds = useMemo(() => new Set(panelProps.notifications.filter(item => item.is_read).map(item => item.id)), [panelProps.notifications]);
  useEffect(() => sync(readIds), [readIds, sync]);
  useDriverRealtime({
    // Cảnh báo mới: tải lại /alerts để có thông báo (notificationId) của chính mình; chỉ cảnh báo có thông báo chưa đọc mới thành toast.
    onAlert: () => void alerts.load(),
    onIncidentUpdated: payload => notice.info(
      payload.status === 'CLOSED' ? `Sự cố #${payload.incidentId} đã xử lý xong` : `Điều phối viên đã phản hồi sự cố #${payload.incidentId}`,
      [payload.handlingNote, payload.expectedAt && `Dự kiến xử lý xong lúc ${new Date(payload.expectedAt).toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit' })}`]
        .filter(Boolean).join(' · ') || undefined,
    ),
    onNotification: addNotice,
    onHorseReportViewed,
    onPoll: () => void alerts.load(),
    onResync: () => { void alerts.load(); void refresh(); },
  });
  const role = crewRole ?? 'DRIVER';
  const roleLabel = ROLE_LABEL[role];
  const date = today.format(new Date());

  return (
    <div className="drs">
      {confirmLogout && <LogoutDialog hasChanges={false} onCancel={() => setConfirmLogout(false)} onConfirm={() => { setConfirmLogout(false); logout(); }} />}
      <a className="drs-skip" href="#drs-main">Đến nội dung chính</a>

      <aside className="drs-sidebar">
        <div className="drs-sidebar-inner">
          <div className="drs-brand"><span aria-hidden="true">V</span>Vận chuyển ngựa</div>
          <div className="drs-role">{role} · {roleLabel}</div>
          <p className="drs-nav-label">ĐIỀU HƯỚNG</p>
          <nav aria-label={`Điều hướng ${roleLabel.toLowerCase()}`}>
            {nav.map(item => (
              <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>
                <span aria-hidden="true">{item.icon}</span>{item.title}
              </button>
            ))}
          </nav>
          <AccountProfile account={account} roleName={roleLabel}><Button type="text" className="drs-logout" icon={<LogoutOutlined />} aria-label="Đăng xuất" onClick={() => setConfirmLogout(true)} /></AccountProfile>
        </div>
      </aside>

      <main className="drs-main" id="drs-main" tabIndex={-1}>
        <header className="drs-topbar">
          <div className={'drs-heading' + (showDescription ? ' is-described' : '')}>
            <p className="drs-breadcrumb">{roleLabel}<span aria-hidden="true">/</span>{heading.title}</p>
            <h1>{heading.title}</h1>
            <p>{heading.description}</p>
          </div>
          <div className="drs-tools">
            {searchPlaceholder && (
              <Input
                className="drs-search" allowClear prefix={<SearchOutlined />} placeholder={searchPlaceholder}
                aria-label={searchPlaceholder} value={search} onChange={event => onSearch(event.target.value)}
              />
            )}
            {topbarAction}
            <Badge count={unreadCount} overflowCount={9} size="small" offset={[-6, 6]}>
              <Button className="drs-tool" icon={<BellOutlined />} aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`} onClick={() => { setAlertsListOpen(false); setBellOpen(true); }} />
            </Badge>
            <span className="drs-tool drs-date"><CalendarOutlined aria-hidden="true" /><time dateTime={new Date().toISOString().slice(0, 10)}>{date.charAt(0).toUpperCase() + date.slice(1)}</time></span>
          </div>
        </header>
        {children}
      </main>

      <Drawer
        open={bellOpen} onClose={() => { setBellOpen(false); alerts.resume(); }} size={520} title="Thông báo" className="drs-notifications"
        extra={<Button size="small" type="text" icon={<ReloadOutlined />} aria-label="Làm mới thông báo" onClick={panelProps.onRefresh} loading={panelProps.loading} />}
      >
        {alertsListOpen && <OpenAlertsList alerts={alerts.openAlerts} onClose={alerts.close} />}
        <NotificationsPanel {...panelProps} compact accentOf={accentOf} />
      </Drawer>
    </div>
  );
}
