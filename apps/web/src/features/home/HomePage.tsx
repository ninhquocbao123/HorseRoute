import { signOut } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { useMe } from '../users/hooks/useMe';

export default function HomePage() {
  const { data, isLoading, error } = useMe();

  return (
    <div className="container">
      <div className="header">
        <h2>Trang chủ</h2>
        <button onClick={() => signOut(auth)}>Đăng xuất</button>
      </div>
      <div className="card">
        {isLoading && 'Đang tải...'}
        {error && <div className="error">Không tải được thông tin user</div>}
        {data && (
          <pre>{JSON.stringify(data, null, 2)}</pre>
        )}
      </div>
    </div>
  );
}
