import { useState, type ReactNode } from 'react';
import { Badge, Button, Drawer, Input } from 'antd';
import { BellOutlined, CalendarOutlined, LogoutOutlined, SearchOutlined, TruckOutlined, WarningOutlined } from '@ant-design/icons';
import type { CrewRole, IUser } from '@my-project/shared';
import LogoutDialog from '../../auth/pages/components/LogoutDialog';
import NotificationsPanel from '../../notifications/NotificationsPanel';
import { useNotifications } from '../../notifications/useNotifications';
import './driver-shell.css';

export const DRIVER_NAV = [
  { id: 'trip', title: 'Chuyến vận chuyển', icon: <TruckOutlined /> },
  { id: 'incident', title: 'Báo cáo sự cố', icon: <WarningOutlined /> },
];

const ROLE_LABEL: Record<CrewRole, string> = { DRIVER: 'Tài xế', ESCORT: 'Hộ tống' };
const today = new Intl.DateTimeFormat('vi-VN', { weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric' });

/** Khung riêng của Driver/Escort (Figma D1/D1b): sidebar 2 mục, topbar có tìm kiếm, chuông và ngày hôm nay. */
export default function DriverShell({ account, logout, view, onNavigate, crewRole, heading, search, onSearch, children }: {
  account: IUser;
  logout: () => void;
  view: string;
  onNavigate: (view: string) => void;
  /** Vai trò trong chuyến đang chọn; chưa có chuyến thì hiện "Tài xế". */
  crewRole: CrewRole | undefined;
  heading: { title: string; description: string };
  search: string;
  onSearch: (value: string) => void;
  children: ReactNode;
}) {
  const [confirmLogout, setConfirmLogout] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);
  const { panelProps, unreadCount } = useNotifications(String(account.id));
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
          <div className="drs-role"><span aria-hidden="true" />{role} · {roleLabel}</div>
          <p className="drs-nav-label">ĐIỀU HƯỚNG</p>
          <nav aria-label="Điều hướng tài xế">
            {DRIVER_NAV.map(item => (
              <button key={item.id} type="button" aria-current={view === item.id ? 'page' : undefined} onClick={() => onNavigate(item.id)}>
                <span aria-hidden="true">{item.icon}</span>{item.title}
              </button>
            ))}
          </nav>
          <div className="drs-user">
            <span className="drs-avatar" aria-hidden="true">{account.fullName.trim().split(/\s+/).pop()?.slice(0, 1)}</span>
            <span className="drs-user-name"><strong>{account.fullName}</strong><small>{roleLabel}</small></span>
            <Button type="text" className="drs-logout" icon={<LogoutOutlined />} aria-label="Đăng xuất" onClick={() => setConfirmLogout(true)} />
          </div>
        </div>
      </aside>

      <main className="drs-main" id="drs-main" tabIndex={-1}>
        <header className="drs-topbar">
          <div className="drs-heading">
            <p className="drs-breadcrumb">{roleLabel}<span aria-hidden="true">/</span>{heading.title}</p>
            <h1>{heading.title}</h1>
            <p>{heading.description}</p>
          </div>
          <div className="drs-tools">
            <Input
              className="drs-search" allowClear prefix={<SearchOutlined />} placeholder="Tìm mã đơn, khách hàng…"
              aria-label="Tìm chuyến theo mã đơn hoặc khách hàng" value={search} onChange={event => onSearch(event.target.value)}
            />
            <Badge count={unreadCount} size="small" offset={[-6, 6]}>
              <Button className="drs-tool" icon={<BellOutlined />} aria-label={`Thông báo${unreadCount ? `, ${unreadCount} chưa đọc` : ''}`} onClick={() => setBellOpen(true)} />
            </Badge>
            <span className="drs-tool drs-date"><CalendarOutlined aria-hidden="true" /><time dateTime={new Date().toISOString().slice(0, 10)}>{date.charAt(0).toUpperCase() + date.slice(1)}</time></span>
          </div>
        </header>
        {children}
      </main>

      <Drawer open={bellOpen} onClose={() => setBellOpen(false)} size={520} title="Thông báo" className="drs-notifications">
        <NotificationsPanel {...panelProps} />
      </Drawer>
    </div>
  );
}
