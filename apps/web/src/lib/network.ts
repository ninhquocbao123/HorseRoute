/**
 * Trạng thái mạng dùng chung cho banner (plan_design: trạng thái mất mạng, mạng chậm).
 * - `offline`: trình duyệt báo mất mạng (sự kiện online/offline).
 * - `unreachable`: còn mạng nhưng request gần nhất không tới được máy chủ (không có phản hồi); hết khi có request thành công.
 * - `slow`: có request chạy quá SLOW_REQUEST_MS.
 * axios.ts gọi `trackRequest` cho mọi request.
 */
export const SLOW_REQUEST_MS = 8_000;
export const RETRY_EVENT = 'hr:retry';

export type NetworkState = { offline: boolean; unreachable: boolean; slow: boolean; reconnectedAt: number };

let state: NetworkState = { offline: typeof navigator !== 'undefined' && navigator.onLine === false, unreachable: false, slow: false, reconnectedAt: 0 };
const listeners = new Set<() => void>();
let slowCount = 0;

function set(patch: Partial<NetworkState>) {
  const next = { ...state, ...patch };
  if (next.offline === state.offline && next.unreachable === state.unreachable && next.slow === state.slow && next.reconnectedAt === state.reconnectedAt) return;
  state = next;
  listeners.forEach(fn => fn());
}

export const getNetworkState = () => state;
export function subscribeNetwork(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }

if (typeof window !== 'undefined') {
  window.addEventListener('offline', () => set({ offline: true }));
  window.addEventListener('online', () => set({ offline: false, unreachable: false, reconnectedAt: Date.now() }));
}

/** Gọi khi bắt đầu một request; trả hàm gọi khi request kết thúc (`reached`: máy chủ có trả lời). */
export function trackRequest() {
  let counted = false;
  const timer = setTimeout(() => { counted = true; slowCount++; set({ slow: true }); }, SLOW_REQUEST_MS);
  return (reached: boolean) => {
    clearTimeout(timer);
    if (counted) { slowCount = Math.max(0, slowCount - 1); if (!slowCount) set({ slow: false }); }
    if (reached) { if (state.unreachable) set({ unreachable: false, reconnectedAt: Date.now() }); }
    else if (!state.offline) set({ unreachable: true });
  };
}

/** Người dùng bấm "Thử lại" trên banner: các màn đang mở tải lại dữ liệu (không tải lại trang, không mất dữ liệu đang nhập). */
export function requestRetry() {
  set({ unreachable: false });
  window.dispatchEvent(new CustomEvent(RETRY_EVENT));
}
