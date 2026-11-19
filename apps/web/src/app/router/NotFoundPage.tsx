import ErrorPage from '../../components/ui/ErrorPage';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { homePathFor } from './home-path';

/** Trang 404: đã đăng nhập thì về trang làm việc đúng vai trò, chưa thì về trang chủ và đăng nhập (BUG-27). */
export default function NotFoundPage() {
  const { account } = useAuth();
  return <ErrorPage kind={404} signedIn={!!account} homePath={homePathFor(account?.role)} />;
}
