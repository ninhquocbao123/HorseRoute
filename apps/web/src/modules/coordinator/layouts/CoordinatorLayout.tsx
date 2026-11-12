import AccountProfile from '../../../components/AccountProfile';
import {
  BellOutlined,
  CalendarOutlined,
  CarOutlined,
  DashboardOutlined,
  InboxOutlined,
  LogoutOutlined,
  MenuFoldOutlined,
  MenuOutlined,
  MenuUnfoldOutlined,
  UserOutlined,
  WarningOutlined,
} from '@ant-design/icons';
import { Avatar, Badge, Button, ConfigProvider, Drawer, Grid, Layout, Menu, Modal, Tooltip, Typography } from 'antd';
import type { MenuProps } from 'antd';
import { useEffect, useMemo, useState } from 'react';
import { Outlet, useBlocker, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../../features/auth/hooks/useAuth';
import { coordinatorPaths } from '../routes/coordinator.paths';
import { coordinatorTheme } from '../theme/coordinator.theme';
import { IncidentCenterProvider, useIncidentCenter } from '../incidents/IncidentCenter';
import CoordinatorBell from '../incidents/CoordinatorBell';
import '../styles/coordinator.css';
import '../styles/reference.css';
import '../styles/assignment-picker.css';

const { Header, Sider, Content } = Layout;

/** Nhãn menu "Xử lý sự cố" kèm badge đỏ số sự cố đang mở (mới + đang xử lý). */
function IncidentsMenuLabel() {
  const { openCount } = useIncidentCenter();
  return <span className="coord-menu-label">Xử lý sự cố<Badge count={openCount} size="small" /></span>;
}

const menuItems: MenuProps['items'] = [
  { key: coordinatorPaths.dashboard, icon: <DashboardOutlined />, label: 'Tổng quan' },
  { key: coordinatorPaths.trips, icon: <CarOutlined />, label: 'Chuyến vận chuyển' },
  { key: coordinatorPaths.fleet, icon: <InboxOutlined />, label: 'Phương tiện' },
  { key: coordinatorPaths.incidents, icon: <WarningOutlined />, label: <IncidentsMenuLabel /> },
  { key: coordinatorPaths.notifications, icon: <BellOutlined />, label: 'Thông báo' },
];

const pageTitles: Record<string, { title: string; subtitle?: string }> = {
  [coordinatorPaths.incidents]: { title: 'Xử lý sự cố', subtitle: 'Sự cố tài xế / hộ tống gửi lên: tiếp nhận, gửi hướng xử lý và theo dõi tới khi xong' },
  [coordinatorPaths.dashboard]: { title: 'Không gian điều phối' },
  [coordinatorPaths.trips]: { title: 'Danh sách chuyến' },
  [coordinatorPaths.fleet]: { title: 'Phương tiện', subtitle: 'Thêm xe, sửa sức chứa và trạng thái, xóa xe chưa từng chạy' },
  [coordinatorPaths.notifications]: { title: 'Trung tâm thông báo', subtitle: 'Cập nhật kế hoạch, phương tiện và công việc điều phối' },
  [coordinatorPaths.account]: { title: 'Tài khoản điều phối', subtitle: 'Thông tin tài khoản đang đăng nhập' },
};

function Brand({ collapsed = false, onClick }: { collapsed?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`coordinator-brand${collapsed ? ' is-collapsed' : ''}`} onClick={onClick} aria-label="Về tổng quan điều phối">
      <span className="brand-mark">H</span>
      {!collapsed && <span>HorseRoute</span>}
    </button>
  );
}

function formatCurrentDate() {
  const formatted = new Intl.DateTimeFormat('vi-VN', {
    weekday: 'long', day: '2-digit', month: '2-digit', year: 'numeric', timeZone: 'Asia/Ho_Chi_Minh',
  }).format(new Date());
  return formatted.charAt(0).toUpperCase() + formatted.slice(1);
}

export default function CoordinatorLayout() {
  const { account, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [logoutOpen, setLogoutOpen] = useState(false);
  const [dirty, setDirty] = useState(false);
  const blocker = useBlocker(dirty);
  useEffect(() => { const warn = (e: BeforeUnloadEvent) => { if (dirty) { e.preventDefault(); e.returnValue = ''; } }; window.addEventListener('beforeunload',warn); return () => window.removeEventListener('beforeunload',warn); }, [dirty]);
  const screens = Grid.useBreakpoint();
  const location = useLocation();
  const navigate = useNavigate();
  const isDesktop = Boolean(screens.lg);

  const selectedKey = useMemo(() => {
    return menuItems?.find(item => item && 'key' in item && location.pathname.startsWith(String(item.key)))?.key?.toString()
      ?? coordinatorPaths.dashboard;
  }, [location.pathname]);

  const meta = location.pathname.startsWith(`${coordinatorPaths.trips}/`)
    ? { title: 'Lộ trình vận chuyển' }
    : pageTitles[location.pathname] ?? { title: 'HorseRoute' };

  const go = (path: string) => {
    navigate(path);
    setDrawerOpen(false);
  };
  const handleMenuClick: MenuProps['onClick'] = ({ key }) => go(key);
  const initial = account?.fullName.trim().slice(0, 1).toUpperCase() || 'C';

  const userPanel = (compact = false) => account ? <AccountProfile account={account} roleName="Điều phối viên" compact={compact}><Button type="text" icon={<LogoutOutlined />} aria-label="Đăng xuất" onClick={() => setLogoutOpen(true)} /></AccountProfile> : null;

  const sidebarContent = (compact = false) => (
    <>
      <div className={`coordinator-brand-row${compact ? ' is-collapsed' : ''}`}>
        <Brand collapsed={compact} onClick={() => go(coordinatorPaths.dashboard)} />
        {isDesktop && (
          <Tooltip title={compact ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'} placement="right">
            <Button
              type="text"
              className="coordinator-sider-toggle"
              icon={compact ? <MenuUnfoldOutlined /> : <MenuFoldOutlined />}
              onClick={() => setCollapsed(value => !value)}
              aria-label={compact ? 'Mở rộng thanh bên' : 'Thu gọn thanh bên'}
            />
          </Tooltip>
        )}
      </div>
      {!compact && <div className="coordinator-role-chip"><span />Điều phối viên</div>}
      {!compact && <div className="coordinator-nav-heading">ĐIỀU PHỐI</div>}
      <Menu theme="dark" mode="inline" selectedKeys={[selectedKey]} items={menuItems} onClick={handleMenuClick} inlineCollapsed={compact} />
      <div className="coordinator-sider-user">{userPanel(compact)}</div>
    </>
  );

  return (
    <ConfigProvider theme={coordinatorTheme} getPopupContainer={trigger => trigger?.closest('.coordinator-scope') as HTMLElement || document.body}>
      <div className="coordinator-scope coordinator-app">
        <IncidentCenterProvider accountId={String(account?.id ?? '')}>
        <Layout className="coordinator-shell">
          {isDesktop && (
            <Sider width={296} collapsedWidth={88} collapsed={collapsed} trigger={null} className="coordinator-sider">
              {sidebarContent(collapsed)}
            </Sider>
          )}
          <Drawer
            placement="left" width={296} open={!isDesktop && drawerOpen} onClose={() => setDrawerOpen(false)}
            rootClassName="coordinator-scope coordinator-mobile-drawer" styles={{ body: { padding: 18 }, header: { display: 'none' } }}
          >
            {sidebarContent(false)}
          </Drawer>
          <Layout>
            <Header className="coordinator-header">
              <div className="coordinator-header__title">
                {!isDesktop && <Button type="text" icon={<MenuOutlined />} onClick={() => setDrawerOpen(true)} aria-label="Mở menu" />}
                <div>
                  <Typography.Title level={1}>{meta.title}</Typography.Title>
                  {meta.subtitle && <Typography.Text type="secondary">{meta.subtitle}</Typography.Text>}
                </div>
              </div>
              <div className="coordinator-header__tools">
                <Tooltip title="Tài khoản"><Button icon={<UserOutlined />} onClick={() => go(coordinatorPaths.account)} aria-label="Tài khoản" /></Tooltip>
                <CoordinatorBell />
                <Button icon={<CalendarOutlined />} className="coordinator-date-button">{formatCurrentDate()}</Button>
              </div>
            </Header>
            <Content className="coordinator-content"><Outlet context={{setDirty,go}} /></Content>
          </Layout>
        </Layout>
        </IncidentCenterProvider>
        <Modal
          open={blocker.state === 'blocked'} title="Bạn có thay đổi chưa lưu"
          okText="Rời trang" cancelText="Ở lại"
          onOk={() => { if (blocker.state === 'blocked') blocker.proceed(); }}
          onCancel={() => { if (blocker.state === 'blocked') blocker.reset(); }}
        >Rời trang sẽ bỏ những thay đổi chưa lưu.</Modal>
        <Modal
          open={logoutOpen} centered title="Bạn muốn đăng xuất?" okText="Đăng xuất" cancelText="Ở lại"
          rootClassName="coordinator-scope coordinator-modal" onCancel={() => setLogoutOpen(false)}
          onOk={() => { setLogoutOpen(false); logout(); navigate('/staff/login', { replace: true }); }}
        >
          <p>{dirty ? 'Bạn có thay đổi chưa lưu. Đăng xuất sẽ bỏ những thay đổi này.' : 'Bạn sẽ cần đăng nhập lại để tiếp tục sử dụng hệ thống.'}</p>
        </Modal>
      </div>
    </ConfigProvider>
  );
}
