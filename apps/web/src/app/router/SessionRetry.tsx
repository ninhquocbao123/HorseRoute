import { Button, Result } from 'antd';
import { useAuth } from '../../features/auth/hooks/useAuth';

/** Còn phiên đăng nhập nhưng chưa tải được tài khoản (máy chủ bận, mất mạng): cho thử lại, không đá về màn đăng nhập. */
export default function SessionRetry() {
  const { syncError, retrySync, logout } = useAuth();
  return (
    <main className="container" style={{ paddingTop: 48 }}>
      <Result
        status="warning"
        title="Chưa tải được tài khoản"
        subTitle={syncError}
        extra={[
          <Button key="retry" type="primary" onClick={retrySync}>Thử lại</Button>,
          <Button key="logout" onClick={logout}>Đăng xuất</Button>,
        ]}
      />
    </main>
  );
}
