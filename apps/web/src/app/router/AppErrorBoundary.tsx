import { Component, useEffect, type ErrorInfo, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import ErrorPage from '../../components/ui/ErrorPage';
import { useAuth } from '../../features/auth/hooks/useAuth';
import { homePathFor } from './home-path';

/** Lỗi tải code trang cũ sau khi deploy (tab mở từ trước, file chunk cũ đã bị thay). */
export const isChunkError = (error: unknown) =>
  /Failed to fetch dynamically imported module|Importing a module script failed|error loading dynamically imported module|ChunkLoadError|Loading chunk [\w-]+ failed/i.test(String((error as Error)?.message ?? error));

type Props = { children: ReactNode; resetKey: string; signedIn: boolean; homePath: string };
type State = { error: Error | null; id: string };

/**
 * Error Boundary toàn cục: một component lỗi khi hiển thị không làm trắng cả ứng dụng nữa.
 * Hiện trang 500 kèm mã lỗi để gửi quản trị viên; đổi trang (resetKey) thì thử hiển thị lại.
 * Lỗi tải code cũ sau deploy: báo có phiên bản mới, tự tải lại một lần.
 */
class Boundary extends Component<Props, State> {
  state: State = { error: null, id: '' };

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { error, id: Date.now().toString(36).toUpperCase() };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[app] render failed', this.state.id, error, info.componentStack);
    if (isChunkError(error)) {
      // Tự tải lại đúng một lần cho mỗi lần mở tab, tránh vòng lặp khi máy chủ thật sự lỗi.
      try {
        if (!sessionStorage.getItem('hr-chunk-reload')) { sessionStorage.setItem('hr-chunk-reload', '1'); window.location.reload(); }
      } catch { /* storage bị chặn: để người dùng bấm tải lại */ }
    }
  }

  componentDidUpdate(prev: Props) {
    if (prev.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null, id: '' });
  }

  render() {
    const { error, id } = this.state;
    if (!error) return this.props.children;
    const chunk = isChunkError(error);
    return <ErrorPage kind={chunk ? 'chunk' : 500} signedIn={this.props.signedIn} homePath={this.props.homePath}
      detail={chunk ? undefined : `Mã lỗi: ${id}\nTrang: ${window.location.pathname}${window.location.search}\n${error.name}: ${error.message}`} />;
  }
}

export default function AppErrorBoundary({ children }: { children: ReactNode }) {
  const { pathname } = useLocation();
  const { account } = useAuth();
  // Mở được trang bình thường một lúc thì cho phép tự tải lại lần nữa ở lần deploy sau.
  useEffect(() => { const t = setTimeout(() => { try { sessionStorage.removeItem('hr-chunk-reload'); } catch { /* bỏ qua */ } }, 10_000); return () => clearTimeout(t); }, []);
  return <Boundary resetKey={pathname} signedIn={!!account} homePath={homePathFor(account?.role)}>{children}</Boundary>;
}
