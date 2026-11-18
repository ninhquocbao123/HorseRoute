import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  BarChartOutlined,
  BellOutlined,
  CheckOutlined,
  DashboardOutlined,
  LogoutOutlined,
  NotificationOutlined,
  SafetyCertificateOutlined,
  TeamOutlined,
} from '@ant-design/icons';
import { Badge, Button, Empty, Popover, Segmented, Spin, Tooltip } from 'antd';
import AccountProfile from '../../components/AccountProfile';
import BrandLogo from '../../components/BrandLogo';
import { useFeedback } from '../../components/useFeedback';
import { api } from '../../lib/axios';
import type { DashboardProps } from '../auth/pages/components/DashboardLayout';
import type { Notice } from '../notifications/NotificationsPanel';
import { timeAgo } from '../notifications/time-ago';
import { accountsApi, type AdminOverviewStats } from './accounts.api';
import AdminOverview from './AdminOverview';
import AccountsWorkspace from './AccountsWorkspace';
import AdminRevenue from './AdminRevenue';
import AdminProfile from './AdminProfile';
import './admin.css';
import { onNoticeChange } from '../notifications/notice-meta';

type AdminView = 'overview' | 'accounts' | 'revenue' | 'profile';

const nav = [
  { id: 'overview' as AdminView, label: 'Tổng quan', icon: <DashboardOutlined /> },
  { id: 'accounts' as AdminView, label: 'Quản lý tài khoản', icon: <TeamOutlined /> },
  { id: 'revenue' as AdminView, label: 'Doanh thu', icon: <BarChartOutlined /> },
  { id: 'profile' as AdminView, label: 'Hồ sơ & Bảo mật', icon: <SafetyCertificateOutlined /> },
];

export default function AdminWorkspace({ account, logout }: DashboardProps) {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const { message, modal } = useFeedback();

  const requested = (params.get('view') as AdminView) || 'overview';
  const view: AdminView = nav.some(n => n.id === requested) ? requested : 'overview';

  const [roleFilterForAccounts, setRoleFilterForAccounts] = useState<string>('ALL');
  const [stats, setStats] = useState<AdminOverviewStats | null>(null);
  const [statsLoading, setStatsLoading] = useState(true);

  // Notification popup states
  const [notices, setNotices] = useState<Notice[]>([]);
  const [noticeLoading, setNoticeLoading] = useState(false);
  const [noticesOpen, setNoticesOpen] = useState(false);
  const [unreadOnly, setUnreadOnly] = useState(false);
  const [markingId, setMarkingId] = useState<string | null>(null);

  useEffect(() => {
    if (requested !== view) {
      setParams({ view }, { replace: true });
    }
  }, [requested, view, setParams]);

  // Load Overview Stats
  const loadStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const data = await accountsApi.getOverviewStats();
      setStats(data);
    } catch {
      // Keep silent on background stats error
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Load Notifications
  const loadNotices = useCallback(async () => {
    setNoticeLoading(true);
    try {
      const { data } = await api.get<Notice[]>('/notifications');
      setNotices(data);
    } catch {
      // Keep silent on notice load error
    } finally {
      setNoticeLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStats();
    void loadNotices();
  }, [loadStats, loadNotices]);

  useEffect(() => onNoticeChange(() => void loadNotices()), [loadNotices]);

  async function markNotice(id: string) {
    if (markingId) return;
    setMarkingId(id);
    try {
      await api.post(`/notifications/${id}/read`);
      setNotices(ns => ns.map(n => (n.id === id ? { ...n, is_read: 1 } : n)));
      void message.success('Đã đánh dấu thông báo là đã đọc.');
    } catch {
      void message.error('Không thể cập nhật trạng thái thông báo.');
    } finally {
      setMarkingId(null);
    }
  }

  async function markAllRead() {
    try {
      await Promise.all(
        notices.filter(n => !n.is_read).map(n => api.post(`/notifications/${n.id}/read`))
      );
      setNotices(ns => ns.map(n => ({ ...n, is_read: 1 })));
      void message.success('Đã đánh dấu tất cả thông báo là đã đọc.');
    } catch {
      void message.error('Không thể cập nhật thông báo.');
    }
  }

  function go(nextView: AdminView) {
    setParams({ view: nextView });
  }

  function handleSelectRoleFromOverview(roleKind: string) {
    setRoleFilterForAccounts(roleKind);
    go('accounts');
  }

  function handleLogout() {
    modal.confirm({
      title: 'Đăng xuất khỏi hệ thống?',
      content: 'Bạn sẽ cần đăng nhập lại để tiếp tục quản trị.',
      okText: 'Đăng xuất',
      cancelText: 'Quay lại',
      onOk: logout,
    });
  }

  const unreadCount = notices.filter(n => !n.is_read).length;
  const filteredNotices = notices.filter(n => !unreadOnly || !n.is_read);

  // Date format matching screenshot (e.g. Thứ 4, 18/11/2026)
  const now = new Date();
  const dayNames = ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];
  const dayOfWeek = dayNames[now.getDay()];
  const dayStr = String(now.getDate()).padStart(2, '0');
  const monthStr = String(now.getMonth() + 1).padStart(2, '0');
  const yearStr = now.getFullYear();
  const formattedDate = `${dayOfWeek}, ${dayStr}/${monthStr}/${yearStr}`;

  const viewInfo: Record<AdminView, { label: string; desc: string }> = {
    overview: {
      label: 'Tổng quan',
      desc: 'Theo dõi tổng quan tài khoản người dùng, cơ cấu nhân sự và trạng thái vận hành',
    },
    accounts: {
      label: 'Quản lý tài khoản',
      desc: 'Khởi tạo tài khoản nhân sự, điều chỉnh vai trò, đặt lại mật khẩu và khóa tài khoản',
    },
    revenue: {
      label: 'Doanh thu dự án',
      desc: 'Báo cáo tổng doanh thu dự án, thống kê số liệu theo tháng, năm và xuất tệp Excel',
    },
    profile: {
      label: 'Hồ sơ & Bảo mật',
      desc: 'Thông tin tài khoản cá nhân, cơ chế phân quyền tối cao và tiêu chuẩn an ninh',
    },
  };

  // Notification Popover Content
  const notificationContent = (
    <div style={{ width: 340, maxWidth: '90vw' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          paddingBottom: 10,
          borderBottom: '1px solid #e0eaea',
          marginBottom: 10,
        }}
      >
        <span style={{ fontWeight: 700, fontSize: 14 }}>Thông báo</span>
        <Segmented
          size="small"
          value={unreadOnly ? 'unread' : 'all'}
          onChange={val => setUnreadOnly(val === 'unread')}
          options={[
            { label: 'Tất cả', value: 'all' },
            { label: `Chưa đọc (${unreadCount})`, value: 'unread' },
          ]}
        />
      </div>

      <div style={{ maxHeight: 360, overflowY: 'auto' }}>
        {noticeLoading ? (
          <div style={{ padding: 30, textAlign: 'center' }}>
            <Spin size="small" />
          </div>
        ) : !filteredNotices.length ? (
          <Empty
            image={Empty.PRESENTED_IMAGE_SIMPLE}
            description={unreadOnly ? 'Không có thông báo chưa đọc' : 'Chưa có thông báo nào'}
          />
        ) : (
          filteredNotices.map(n => (
            <div
              key={n.id}
              style={{
                padding: '10px 8px',
                borderRadius: 8,
                background: !n.is_read ? '#f0f8f6' : 'transparent',
                borderBottom: '1px solid #f0f4f4',
                cursor: 'pointer',
                display: 'flex',
                gap: 10,
                alignItems: 'flex-start',
              }}
              onClick={() => {
                if (!n.is_read) void markNotice(n.id);
              }}
            >
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: !n.is_read ? '#df4455' : 'transparent',
                  marginTop: 6,
                  flexShrink: 0,
                }}
              />
              <div style={{ flex: 1, minWidth: 0 }}>
                <p style={{ margin: 0, fontSize: 12, lineHeight: 1.4, color: '#0d2a2e' }}>
                  {n.content}
                </p>
                {n.created_at && (
                  <span style={{ fontSize: 10, color: 'var(--muted)', marginTop: 4, display: 'block' }}>
                    {timeAgo(n.created_at)}
                  </span>
                )}
              </div>
              {!n.is_read && (
                <Tooltip title="Đánh dấu đã đọc">
                  <Button
                    type="text"
                    size="small"
                    shape="circle"
                    icon={<CheckOutlined style={{ fontSize: 11 }} />}
                    loading={markingId === n.id}
                    onClick={e => {
                      e.stopPropagation();
                      void markNotice(n.id);
                    }}
                  />
                </Tooltip>
              )}
            </div>
          ))
        )}
      </div>

      <div
        style={{
          borderTop: '1px solid #e0eaea',
          paddingTop: 8,
          marginTop: 8,
          display: 'flex',
          justifyContent: 'space-between',
        }}
      >
        {unreadCount > 0 && (
          <Button type="link" size="small" style={{ padding: 0 }} onClick={markAllRead}>
            Đánh dấu tất cả đã đọc
          </Button>
        )}
        <Button
          type="link"
          size="small"
          style={{ padding: 0, marginLeft: 'auto' }}
          onClick={() => void loadNotices()}
        >
          Làm mới
        </Button>
      </div>
    </div>
  );

  return (
    <div className="adm">
      {/* Sidebar - Matching Manager & Specialist */}
      <aside className="adm-sidebar">
        <a
          className="adm-brand"
          href="/dashboard"
          onClick={e => {
            e.preventDefault();
            go('overview');
          }}
        >
          <BrandLogo />
          <span>Vận chuyển ngựa</span>
        </a>

        <span className="adm-role">● ADMIN · Quản trị viên</span>

        <small>ĐIỀU HƯỚNG</small>
        <nav>
          {nav.map(n => (
            <button
              key={n.id}
              className={view === n.id ? 'active' : ''}
              onClick={() => go(n.id)}
            >
              {n.icon}
              <span>{n.label}</span>
            </button>
          ))}
        </nav>

        <AccountProfile account={account} roleName="Quản trị viên">
          <button aria-label="Đăng xuất" onClick={handleLogout}>
            <LogoutOutlined />
          </button>
        </AccountProfile>
      </aside>

      {/* Main Workspace */}
      <main className="adm-main">
        {/* Top Header */}
        <header className="adm-header">
          <div>
            <small>Quản trị viên / {viewInfo[view].label}</small>
            <h1>{viewInfo[view].label}</h1>
            <p>{viewInfo[view].desc}</p>
          </div>

          <div className="adm-tools">
            {/* Notification Bell with Popover (Exactly matching user requirement) */}
            <Popover
              content={notificationContent}
              trigger="click"
              placement="bottomRight"
              open={noticesOpen}
              onOpenChange={setNoticesOpen}
            >
              <button
                type="button"
                aria-label="Thông báo"
                title="Thông báo hệ thống"
                style={{
                  height: 42,
                  width: 42,
                  borderRadius: 10,
                  border: '1px solid var(--line)',
                  background: 'white',
                  color: 'var(--ink)',
                  display: 'grid',
                  placeItems: 'center',
                  position: 'relative',
                  cursor: 'pointer',
                  fontSize: 16,
                }}
              >
                <BellOutlined />
                {unreadCount > 0 && <i />}
              </button>
            </Popover>

            {/* Date pill matching user screenshot */}
            <span className="adm-today">{formattedDate}</span>
          </div>
        </header>

        {/* Content Tabs */}
        {view === 'overview' && (
          <AdminOverview
            stats={stats}
            loading={statsLoading}
            adminName={account.fullName}
            onSelectRoleFilter={handleSelectRoleFromOverview}
            onCreateAccount={() => {
              setRoleFilterForAccounts('ALL');
              go('accounts');
            }}
            onViewAccounts={() => go('accounts')}
          />
        )}

        {view === 'accounts' && (
          <AccountsWorkspace
            currentUserId={String(account.id)}
            initialRoleFilter={roleFilterForAccounts}
            onDataChanged={() => void loadStats()}
          />
        )}

        {view === 'revenue' && <AdminRevenue />}

        {view === 'profile' && <AdminProfile account={account} />}
      </main>
    </div>
  );
}
