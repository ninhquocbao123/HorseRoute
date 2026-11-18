import {
  AuditOutlined,
  CheckCircleOutlined,
  CrownOutlined,
  GlobalOutlined,
  KeyOutlined,
  LockOutlined,
  SafetyCertificateOutlined,
  UserOutlined,
} from '@ant-design/icons';
import type { IUser } from '@my-project/shared';

type Props = {
  account: IUser;
};

export default function AdminProfile({ account }: Props) {
  const initial = account.fullName.trim().slice(0, 1).toUpperCase() || 'A';

  const privileges = [
    {
      title: 'Quản trị nhân sự & Phân quyền',
      desc: 'Tạo tài khoản nhân sự mới, cập nhật thông tin và chuyển đổi vai trò các bộ phận nội bộ.',
      icon: <UserOutlined style={{ color: '#0958d9' }} />,
    },
    {
      title: 'Khóa & Hủy phiên tức thì',
      desc: 'Ngắt phiên làm việc (Token Revocation) ngay lập tức khi phát hiện rủi ro bảo mật hoặc nhân sự nghỉ việc.',
      icon: <LockOutlined style={{ color: '#d96a6a' }} />,
    },
    {
      title: 'Đặt lại mật khẩu khẩn cấp',
      desc: 'Thiết lập mật khẩu mới an toàn cho nhân sự khi quên hoặc tài khoản bị khóa đăng nhập.',
      icon: <KeyOutlined style={{ color: '#b89927' }} />,
    },
    {
      title: 'Lưu vết kiểm toán (Audit Trail)',
      desc: 'Toàn bộ thao tác tạo mới, đổi quyền, khóa/mở khóa tài khoản đều được ghi nhận lý do và thời gian.',
      icon: <AuditOutlined style={{ color: '#3e9262' }} />,
    },
  ];

  return (
    <div className="adm-profile-grid">
      {/* Left Column: Admin Profile Card */}
      <div className="adm-profile-box">
        <div className="adm-avatar-circle">{initial}</div>
        <h2>{account.fullName}</h2>
        <span style={{ color: 'var(--muted)', fontSize: 13 }}>{account.email}</span>

        <div style={{ marginTop: 12 }}>
          <span className="adm-badge adm-badge-admin" style={{ padding: '6px 14px', fontSize: 11 }}>
            ● ADMIN · Quản trị viên tối cao
          </span>
        </div>

        <dl className="adm-dl">
          <div>
            <dt>Mã tài khoản (ID)</dt>
            <dd style={{ fontFamily: 'monospace' }}>#{account.id}</dd>
          </div>
          <div>
            <dt>Điện thoại</dt>
            <dd>{account.phone || 'Chưa cập nhật'}</dd>
          </div>
          <div>
            <dt>Địa chỉ</dt>
            <dd>{account.address || 'Chưa cập nhật'}</dd>
          </div>
          <div>
            <dt>Trạng thái</dt>
            <dd>
              <span className="adm-badge adm-badge-active">
                <CheckCircleOutlined style={{ marginRight: 3 }} /> Hoạt động
              </span>
            </dd>
          </div>
          <div>
            <dt>Phạm vi thẩm quyền</dt>
            <dd>Toàn quyền hệ thống</dd>
          </div>
        </dl>
      </div>

      {/* Right Column: Privileges & Security Architecture */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div className="adm-card">
          <h2>Quyền hạn &amp; Phạm vi Quản trị</h2>
          <small style={{ color: 'var(--muted)', display: 'block', margin: '4px 0 16px' }}>
            Các đặc quyền được cấp cho tài khoản Quản trị viên
          </small>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14 }}>
            {privileges.map(priv => (
              <div
                key={priv.title}
                style={{
                  padding: 16,
                  border: '1px solid var(--line)',
                  borderRadius: 12,
                  background: '#f9fbfb',
                  display: 'flex',
                  gap: 12,
                }}
              >
                <div style={{ fontSize: 20, marginTop: 2 }}>{priv.icon}</div>
                <div>
                  <strong style={{ display: 'block', fontSize: 13, color: 'var(--ink)', marginBottom: 4 }}>
                    {priv.title}
                  </strong>
                  <p style={{ margin: 0, fontSize: 12, color: 'var(--muted)', lineHeight: 1.5 }}>
                    {priv.desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="adm-card">
          <h2>Cơ chế An toàn &amp; Bảo vệ Dữ liệu</h2>
          <small style={{ color: 'var(--muted)', display: 'block', margin: '4px 0 16px' }}>
            Quy tắc bảo vệ dữ liệu và phiên làm việc
          </small>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, fontSize: 12.5, color: '#4a646a', lineHeight: 1.6 }}>
            <p style={{ margin: 0 }}>
              🛡️ <strong>Cơ chế Hủy phiên đăng nhập (Token Invalidation):</strong> Khi khóa tài khoản, hệ thống sẽ tự động tăng <code>token_version</code> trong cơ sở dữ liệu. Mọi phiên đăng nhập hiện hữu của người dùng sẽ bị vô hiệu hóa ngay lập tức.
            </p>
            <p style={{ margin: 0 }}>
              🛡️ <strong>Bảo vệ Quản trị viên cuối cùng:</strong> Để đảm bảo không bao giờ xảy ra tình trạng mất kiểm soát hệ thống, cơ chế an toàn cấp cơ sở dữ liệu sẽ chặn mọi thao tác khóa hoặc hạ quyền của Quản trị viên hoạt động duy nhất.
            </p>
            <p style={{ margin: 0 }}>
              🛡️ <strong>Ràng buộc chuyến vận chuyển đang chạy:</strong> Nhân sự tổ lái đang được gán vào chuyến xe (RESERVED hoặc IN_TRIP) sẽ không thể bị khóa hoặc đổi vai trò cho đến khi Điều phối viên chỉ định người thay thế để bảo đảm lộ trình an toàn.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
