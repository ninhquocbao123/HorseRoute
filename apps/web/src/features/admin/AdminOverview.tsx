import {
  CarOutlined,
  CheckCircleOutlined,
  CrownOutlined,
  LockOutlined,
  PlusOutlined,
  SafetyCertificateOutlined,
  SafetyOutlined,
  TeamOutlined,
  UserOutlined,
  AuditOutlined,
  SolutionOutlined,
  CompassOutlined,
  RightOutlined,
} from '@ant-design/icons';
import { Button, Progress, Skeleton, Space } from 'antd';
import type { AdminOverviewStats } from './accounts.api';

type Props = {
  stats: AdminOverviewStats | null;
  loading: boolean;
  adminName: string;
  onSelectRoleFilter: (roleKind: string) => void;
  onCreateAccount: () => void;
  onViewAccounts: () => void;
};

export default function AdminOverview({
  stats,
  loading,
  adminName,
  onSelectRoleFilter,
  onCreateAccount,
  onViewAccounts,
}: Props) {
  const activeRate =
    stats && stats.total > 0 ? Math.round((stats.active / stats.total) * 100) : 100;

  const roleCards = [
    {
      kind: 'ADMIN',
      title: 'Quản trị viên',
      sub: 'Toàn quyền cấu hình hệ thống',
      count: stats?.roles.admin ?? 0,
      badgeClass: 'adm-badge-admin',
      icon: <CrownOutlined />,
    },
    {
      kind: 'MANAGER',
      title: 'Quản lý vận hành',
      sub: 'Tiếp nhận đơn, duyệt báo giá',
      count: stats?.roles.manager ?? 0,
      badgeClass: 'adm-badge-manager',
      icon: <AuditOutlined />,
    },
    {
      kind: 'SPECIALIST',
      title: 'Chuyên viên thẩm định',
      sub: 'Thẩm định hồ sơ ngựa & trạm',
      count: stats?.roles.specialist ?? 0,
      badgeClass: 'adm-badge-specialist',
      icon: <SolutionOutlined />,
    },
    {
      kind: 'COORDINATOR',
      title: 'Điều phối viên',
      sub: 'Lập chuyến, điều xe và tổ lái',
      count: stats?.roles.coordinator ?? 0,
      badgeClass: 'adm-badge-coordinator',
      icon: <CompassOutlined />,
    },
    {
      kind: 'DRIVER',
      title: 'Tài xế vận chuyển',
      sub: 'Lái xe chuyên dụng chở ngựa',
      count: stats?.roles.driver ?? 0,
      badgeClass: 'adm-badge-driver',
      icon: <CarOutlined />,
    },
    {
      kind: 'ESCORT',
      title: 'Nhân viên hộ tống',
      sub: 'Chăm sóc ngựa trên suốt lộ trình',
      count: stats?.roles.escort ?? 0,
      badgeClass: 'adm-badge-escort',
      icon: <SafetyOutlined />,
    },
    {
      kind: 'CUSTOMER',
      title: 'Khách hàng',
      sub: 'Người đặt dịch vụ vận chuyển',
      count: stats?.roles.customer ?? 0,
      badgeClass: 'adm-badge-customer',
      icon: <UserOutlined />,
    },
  ];

  return (
    <div>
      {/* Banner */}
      <div className="adm-overview-banner">
        <div>
          <h2>Xin chào, {adminName} 👋</h2>
          <p>
            Không gian làm việc Quản trị viên HorseRoute. Theo dõi toàn diện nhân sự các bộ phận, cấp quyền
            nghiệp vụ, khóa tài khoản nghỉ việc và giám sát tính toàn vẹn của hệ thống.
          </p>
          <div style={{ marginTop: 18 }}>
            <Space size={10} wrap>
              <Button
                className="adm-gold"
                icon={<PlusOutlined />}
                onClick={onCreateAccount}
              >
                Tạo tài khoản nhân sự
              </Button>
              <Button
                ghost
                style={{ borderColor: 'rgba(255,255,255,0.4)', color: '#ffffff', borderRadius: 10, height: 42 }}
                onClick={onViewAccounts}
              >
                Xem danh sách tài khoản
              </Button>
            </Space>
          </div>
        </div>
      </div>

      {/* KPI Stats (Exact format like .mgr-stats) */}
      <div className="adm-stats">
        <article>
          <span>
            TỔNG TÀI KHOẢN
            <i><TeamOutlined /></i>
          </span>
          {loading ? (
            <Skeleton.Button active style={{ width: 80, height: 32 }} />
          ) : (
            <strong>{(stats?.total ?? 0).toLocaleString('vi-VN')}</strong>
          )}
          <small>{stats?.staff ?? 0} nhân sự · {stats?.customer ?? 0} khách hàng</small>
        </article>

        <article>
          <span>
            ĐANG HOẠT ĐỘNG
            <i><CheckCircleOutlined /></i>
          </span>
          {loading ? (
            <Skeleton.Button active style={{ width: 80, height: 32 }} />
          ) : (
            <strong>{(stats?.active ?? 0).toLocaleString('vi-VN')}</strong>
          )}
          <small>Tỷ lệ khả dụng: {activeRate}%</small>
        </article>

        <article>
          <span>
            TÀI KHOẢN BỊ KHÓA
            <i><LockOutlined /></i>
          </span>
          {loading ? (
            <Skeleton.Button active style={{ width: 80, height: 32 }} />
          ) : (
            <strong style={{ color: (stats?.locked ?? 0) > 0 ? '#d96a6a' : undefined }}>
              {(stats?.locked ?? 0).toLocaleString('vi-VN')}
            </strong>
          )}
          <small>
            {(stats?.locked ?? 0) > 0
              ? 'Nhân sự nghỉ việc hoặc vi phạm'
              : 'Tất cả tài khoản bình thường'}
          </small>
        </article>

        <article>
          <span>
            TỔ LÁI SẴN SÀNG
            <i><CarOutlined /></i>
          </span>
          {loading ? (
            <Skeleton.Button active style={{ width: 80, height: 32 }} />
          ) : (
            <strong>{(stats?.crew.total ?? 0).toLocaleString('vi-VN')}</strong>
          )}
          <small>{stats?.crew.driver ?? 0} tài xế · {stats?.crew.escort ?? 0} hộ tống</small>
        </article>
      </div>

      {/* Role Distribution Grid */}
      <div className="adm-card" style={{ marginBottom: 24 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
          <div>
            <h2>Cơ cấu tài khoản theo vai trò</h2>
            <small style={{ color: 'var(--muted)', display: 'block', marginTop: 4 }}>
              Nhấp vào từng vai trò để lọc nhanh danh sách tài khoản tương ứng
            </small>
          </div>
          <Button type="link" onClick={() => onSelectRoleFilter('ALL')} style={{ padding: 0, fontWeight: 600 }}>
            Xem tất cả ({stats?.total ?? 0}) →
          </Button>
        </div>

        <div className="adm-roles-grid">
          {roleCards.map(role => (
            <div
              key={role.kind}
              className="adm-role-card"
              role="button"
              tabIndex={0}
              onClick={() => onSelectRoleFilter(role.kind)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ' ') onSelectRoleFilter(role.kind);
              }}
            >
              <div className="adm-role-card-header">
                <span className={`adm-badge ${role.badgeClass}`}>{role.title}</span>
                <span style={{ fontSize: 16, color: 'var(--muted)' }}>{role.icon}</span>
              </div>
              <strong>{loading ? '—' : role.count.toLocaleString('vi-VN')}</strong>
              <small>{role.sub}</small>
              <div className="adm-role-card-footer">
                <span>Lọc danh sách</span>
                <RightOutlined style={{ fontSize: 10 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* 2 Columns: Guidelines & Ratio */}
      <div className="adm-grid-2col">
        <div className="adm-card">
          <h2>Quy chuẩn Quản trị &amp; Bảo mật</h2>
          <small style={{ color: 'var(--muted)', display: 'block', margin: '4px 0 16px' }}>
            Quy trình vận hành tài khoản an toàn
          </small>

          <div className="adm-guide-list">
            <div className="adm-guide-item">
              <span className="adm-guide-num">01</span>
              <div className="adm-guide-text">
                <strong>Khởi tạo tài khoản nhân sự</strong>
                <p>
                  Chọn đúng vai trò. Riêng tài xế và hộ tống sẽ tự động được hệ thống liên kết hồ sơ tổ lái
                  để Điều phối viên có thể lập chuyến và phân công xe.
                </p>
              </div>
            </div>

            <div className="adm-guide-item">
              <span className="adm-guide-num">02</span>
              <div className="adm-guide-text">
                <strong>Bảo mật mật khẩu ban đầu</strong>
                <p>
                  Cung cấp mật khẩu ban đầu cho nhân sự qua kênh bảo mật nội bộ và nhắc người dùng đổi
                  mật khẩu ngay lần đăng nhập đầu tiên.
                </p>
              </div>
            </div>

            <div className="adm-guide-item">
              <span className="adm-guide-num">03</span>
              <div className="adm-guide-text">
                <strong>Khóa tài khoản khi nghỉ việc</strong>
                <p>
                  Khi khóa tài khoản, người dùng sẽ lập tức bị hủy phiên làm việc. Bắt buộc ghi rõ lý do để
                  lưu vết kiểm toán (Audit Log).
                </p>
              </div>
            </div>

            <div className="adm-guide-item">
              <span className="adm-guide-num">04</span>
              <div className="adm-guide-text">
                <strong>Bảo vệ Quản trị viên tối cao</strong>
                <p>
                  Hệ thống tự động ngăn chặn việc tự khóa tài khoản của chính mình và luôn duy trì ít nhất một
                  Quản trị viên hoạt động để không bị mất quyền điều hành.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="adm-card">
          <h2>Tỷ lệ phân bổ nhân sự</h2>
          <small style={{ color: 'var(--muted)', display: 'block', margin: '4px 0 16px' }}>
            Cơ cấu nhân sự và khách hàng
          </small>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {stats && stats.total > 0 ? (
              <>
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>Nhân sự nội bộ (Staff)</span>
                    <strong>{stats.staff} ({Math.round((stats.staff / stats.total) * 100)}%)</strong>
                  </div>
                  <Progress
                    percent={Math.round((stats.staff / stats.total) * 100)}
                    strokeColor="#0d3e49"
                    showInfo={false}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>Khách hàng (Customer)</span>
                    <strong>{stats.customer} ({Math.round((stats.customer / stats.total) * 100)}%)</strong>
                  </div>
                  <Progress
                    percent={Math.round((stats.customer / stats.total) * 100)}
                    strokeColor="#f4bf42"
                    showInfo={false}
                  />
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6, fontSize: 12 }}>
                    <span style={{ fontWeight: 600 }}>Tổ lái (Tài xế &amp; Hộ tống)</span>
                    <strong>{stats.crew.total} ({Math.round((stats.crew.total / stats.total) * 100)}%)</strong>
                  </div>
                  <Progress
                    percent={Math.round((stats.crew.total / stats.total) * 100)}
                    strokeColor="#3e9262"
                    showInfo={false}
                  />
                </div>
              </>
            ) : (
              <Skeleton active paragraph={{ rows: 3 }} />
            )}

            <div style={{ background: '#f6faf9', padding: 14, borderRadius: 10, marginTop: 8, fontSize: 12, color: 'var(--muted)', lineHeight: 1.6, border: '1px solid var(--line)' }}>
              💡 <strong>Lưu ý nghiệp vụ:</strong> Tài khoản khách hàng tự đăng ký từ ứng dụng/website. Quản trị viên chỉ khóa hoặc mở khóa tài khoản khách hàng khi có xử lý khiếu nại hoặc kiểm toán.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
