import { useEffect, useState, useSyncExternalStore, type ReactNode } from 'react';
import { getNetworkState, requestRetry, subscribeNetwork, RETRY_EVENT } from '../../lib/network';
import { queryClient } from '../../lib/queryClient';
import './network-banner.css';

/**
 * Banner mạng toàn cục (mọi vai trò): mất mạng, không tới được máy chủ, mạng chậm, đã kết nối lại.
 * Không tải lại trang nên không mất dữ liệu đang nhập dở trong form. Có mạng lại hoặc bấm "Thử lại":
 * tải lại các truy vấn đang hiển thị (react-query) và phát sự kiện `hr:retry` cho màn tự tải dữ liệu.
 */
export default function NetworkBanner() {
  const net = useSyncExternalStore(subscribeNetwork, getNetworkState);
  const [justBack, setJustBack] = useState(false);

  useEffect(() => {
    if (!net.reconnectedAt) return;
    setJustBack(true);
    void queryClient.refetchQueries({ type: 'active' });
    window.dispatchEvent(new CustomEvent(RETRY_EVENT));
    const t = setTimeout(() => setJustBack(false), 3_500);
    return () => clearTimeout(t);
  }, [net.reconnectedAt]);

  const retry = () => { requestRetry(); void queryClient.refetchQueries({ type: 'active' }); };

  let tone: 'warn' | 'bad' | 'info' | 'ok' | null = null;
  let body: ReactNode = null;
  if (net.offline) {
    tone = 'warn';
    body = <><b>Mất kết nối mạng.</b> <span>Dữ liệu bạn đang nhập vẫn được giữ; trang tự cập nhật khi có mạng lại.</span></>;
  } else if (net.unreachable) {
    tone = 'bad';
    body = <><b>Không kết nối được máy chủ.</b> <span>Kiểm tra mạng rồi thử lại; dữ liệu đang nhập vẫn được giữ.</span><button type="button" className="hr-net-btn" onClick={retry}>Thử lại</button></>;
  } else if (net.slow) {
    tone = 'info';
    body = <><b>Mạng chậm.</b> <span>Đang tải lâu hơn bình thường, vui lòng chờ thêm.</span></>;
  } else if (justBack) {
    tone = 'ok';
    body = <><b>Đã kết nối lại.</b> <span>Dữ liệu đang được cập nhật.</span></>;
  }

  return (
    <div className="hr-net" role={tone === 'warn' || tone === 'bad' ? 'alert' : 'status'} aria-live={tone === 'warn' || tone === 'bad' ? 'assertive' : 'polite'}>
      {tone && <div className="hr-net-bar" data-tone={tone}><span className="hr-net-dot" aria-hidden="true" />{body}</div>}
    </div>
  );
}
