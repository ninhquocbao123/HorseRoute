import AccountProfile from '../AccountProfile';
import BrandLogo from '../BrandLogo';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import type { IUser } from '@my-project/shared';
import LogoutDialog from '../../features/auth/pages/components/LogoutDialog';
import { workspaces } from '../../features/home/role-workspaces';
import '../../features/home/workspace.css';
import './dashboard-shell.css';

export function dashboardPath(view: string) {
  return view === 'trips' || view === 'routes' ? '/dashboard/trips' : `/dashboard?view=${encodeURIComponent(view)}`;
}

type Props = {
  account: IUser;
  logout: () => void;
  activeView: string;
  children: ReactNode;
  showHeading?: boolean;
  beforeNavigate?: (work: () => void) => void | Promise<void>;
  hasUnsavedChanges?: () => boolean;
};

export default function DashboardShell({
  account, logout, activeView, children, showHeading = true, beforeNavigate, hasUnsavedChanges,
}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const [mobile, setMobile] = useState(false);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const sidebar = useRef<HTMLElement>(null);
  const config = workspaces[account.role] || workspaces.ADMIN;
  const navigation = [
    { id: 'overview', title: 'Tổng quan' }, ...config.areas,
    { id: 'notifications', title: 'Thông báo' }, { id: 'account', title: 'Tài khoản' },
  ];
  const title = navigation.find(item => item.id === activeView)?.title || 'Không gian làm việc';

  useEffect(() => { setMobile(false); }, [location.pathname, location.search]);
  useEffect(() => {
    if (!mobile) return;
    sidebar.current?.querySelector<HTMLButtonElement>('nav button')?.focus();
    const escape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setMobile(false); menuButton.current?.focus(); }
    };
    document.addEventListener('keydown', escape);
    return () => document.removeEventListener('keydown', escape);
  }, [mobile]);

  function go(to: string) {
    const work = () => { setMobile(false); navigate(to); };
    if (beforeNavigate) void beforeNavigate(work);
    else work();
  }

  return (
    <div className="portal portal-dashboard">
      {confirmLogout && <LogoutDialog
        hasChanges={hasUnsavedChanges?.() ?? false}
        onCancel={() => setConfirmLogout(false)}
        onConfirm={() => { setConfirmLogout(false); logout(); }}
      />}
      <a className="portal-skip" href="#portal-main">Đến nội dung chính</a>
      <aside ref={sidebar} id="dashboard-sidebar" className={`portal-sidebar${mobile ? ' is-open' : ''}`}>
        <Link
          className="portal-brand"
          to="/dashboard"
          aria-label="WDP Equine – Về Tổng quan"
          onClick={event => { event.preventDefault(); go('/dashboard'); }}
        >
          <BrandLogo /><div>WDP EQUINE<small>TRANSPORT MANAGEMENT</small></div>
        </Link>
        <div className="portal-role">KHÔNG GIAN LÀM VIỆC<strong>{config.name}</strong></div>
        <nav aria-label="Điều hướng nghiệp vụ">
          {navigation.filter(item => item.id !== 'account').map((item, index) => (
            <button key={item.id} type="button" aria-current={activeView === item.id ? 'page' : undefined}
              onClick={() => go(dashboardPath(item.id))}>
              <span aria-hidden="true">{['◫', '▤', '◇', '↗', '○', '⚙'][index % 6]}</span>{item.title}
            </button>
          ))}
        </nav>
        <AccountProfile account={account} roleName={config.name}><button type="button" aria-label="Đăng xuất" onClick={()=>setConfirmLogout(true)}>↪</button></AccountProfile>
      </aside>
      <div className="portal-body">
        <header className="portal-topbar">
          <button ref={menuButton} type="button" className="portal-menu" aria-label="Bật tắt menu"
            aria-controls="dashboard-sidebar" aria-expanded={mobile} onClick={() => setMobile(value => !value)}>☰</button>
          <div className="portal-breadcrumb">Không gian làm việc / <strong>{title}</strong></div>

        </header>
        <main className="portal-main" id="portal-main" tabIndex={-1}>
          {showHeading && <div className="portal-page-heading"><div>
            <p className="portal-overline">{config.name}</p>
            <h1>{activeView === 'overview' ? config.title : title}</h1><p>{config.intro}</p>
          </div></div>}
          {children}
          <footer className="portal-footer"><span>WDP EQUINE</span><span>Vận chuyển an toàn · Kết nối hành trình</span></footer>
        </main>
      </div>
    </div>
  );
}
