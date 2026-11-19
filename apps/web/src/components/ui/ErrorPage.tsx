import { useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import BrandLogo from '../BrandLogo';
import './error-page.css';

export type ErrorKind = 404 | 403 | 500 | 'chunk';

const copy: Record<string, { code: string; title: string; text: string }> = {
  404: { code: '404', title: 'Không tìm thấy trang', text: 'Đường dẫn có thể đã đổi hoặc trang không còn nữa. Kiểm tra lại địa chỉ hoặc quay về trang làm việc.' },
  403: { code: '403', title: 'Bạn không có quyền xem trang này', text: 'Trang này dành cho vai trò khác. Nếu bạn cần quyền truy cập, hãy liên hệ quản trị viên.' },
  500: { code: '500', title: 'Đã có lỗi khi hiển thị trang', text: 'Lỗi này không làm mất dữ liệu đã lưu. Tải lại trang để thử lại; nếu vẫn lỗi, gửi mã lỗi bên dưới cho quản trị viên.' },
  chunk: { code: 'Cập nhật', title: 'HorseRoute vừa có phiên bản mới', text: 'Trang cần tải lại để dùng phiên bản mới nhất. Dữ liệu đã lưu không bị ảnh hưởng.' },
};

/**
 * Trang trạng thái dùng chung (plan_design mục 4.11): 404, 403, 500 và "có phiên bản mới".
 * Nút chính theo ngữ cảnh: đã đăng nhập thì về trang làm việc, chưa thì về trang chủ và đăng nhập.
 */
export default function ErrorPage({ kind, signedIn, homePath = '/dashboard', detail, onRetry }: {
  kind: ErrorKind; signedIn?: boolean; homePath?: string; detail?: string; onRetry?: () => void;
}) {
  const c = copy[String(kind)];
  const [open, setOpen] = useState(false);
  const reload = onRetry ?? (() => window.location.reload());
  let actions: ReactNode;
  if (kind === 500 || kind === 'chunk') {
    actions = <>
      <button type="button" className="hr-err-btn is-primary" onClick={reload}>Tải lại trang</button>
      <a className="hr-err-btn" href={signedIn ? homePath : '/'}>{signedIn ? 'Về trang làm việc' : 'Về trang chủ'}</a>
    </>;
  } else if (signedIn) {
    actions = <>
      <Link className="hr-err-btn is-primary" to={homePath}>Về trang làm việc</Link>
      <button type="button" className="hr-err-btn" onClick={() => window.history.back()}>Quay lại</button>
    </>;
  } else {
    actions = <>
      <Link className="hr-err-btn is-primary" to="/">Về trang chủ</Link>
      <Link className="hr-err-btn" to="/login">Đăng nhập</Link>
    </>;
  }
  return (
    <main className="hr-err" data-kind={String(kind)}>
      <header className="hr-err-top">
        <Link to={signedIn ? homePath : '/'} className="hr-err-brand" aria-label="HorseRoute"><BrandLogo /><span>HorseRoute</span></Link>
      </header>
      <section className="hr-err-body" aria-labelledby="hr-err-title">
        <span className="hr-err-code" aria-hidden="true">{c.code}</span>
        <Illustration kind={kind} />
        <h1 id="hr-err-title">{c.title}</h1>
        <p>{c.text}</p>
        <div className="hr-err-actions">{actions}</div>
        {detail && (
          <div className="hr-err-detail">
            <button type="button" className="hr-err-link" aria-expanded={open} onClick={() => setOpen(v => !v)}>{open ? 'Ẩn chi tiết kỹ thuật' : 'Xem chi tiết kỹ thuật'}</button>
            {open && <pre>{detail}</pre>}
          </div>
        )}
      </section>
    </main>
  );
}

/** Minh họa nhẹ bằng nét (không ảnh, theo token màu): tuyến đường bị đứt, ổ khóa, cảnh báo. */
function Illustration({ kind }: { kind: ErrorKind }) {
  const common = { width: 120, height: 72, viewBox: '0 0 120 72', fill: 'none', 'aria-hidden': true } as const;
  if (kind === 403) return <svg className="hr-err-art" {...common}><path d="M8 56c18 0 22-16 40-16" className="is-line" /><rect x="50" y="28" width="22" height="20" rx="5" className="is-accent" /><path d="M55 28v-5a6 6 0 0 1 12 0v5" className="is-accent" /><path d="M76 40c16 0 20 16 36 16" className="is-line is-dash" /></svg>;
  if (kind === 500 || kind === 'chunk') return <svg className="hr-err-art" {...common}><path d="M8 56c18 0 22-20 40-20" className="is-line" /><path d="M60 18 74 44H46Z" className="is-accent" /><path d="M60 28v7M60 39v.5" className="is-accent" /><path d="M78 36c16 0 18 20 34 20" className="is-line is-dash" /></svg>;
  return <svg className="hr-err-art" {...common}><circle cx="12" cy="56" r="4" className="is-line" /><path d="M16 56c16 0 20-20 34-20" className="is-line" /><path d="M58 36h8" className="is-accent" /><path d="M74 36c14 0 18 20 30 20" className="is-line is-dash" /><circle cx="108" cy="56" r="4" className="is-line is-dash" /></svg>;
}
