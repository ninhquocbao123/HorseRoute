import { VN_VIEW } from './map-view-plan';

// Map configuration read once from Vite env. Nothing here imports mapbox-gl, so the main bundle stays small.
export const DEFAULT_MAP_STYLE = 'mapbox://styles/mapbox/light-v11';
/** Việt Nam (xem map-view-plan.ts#VN_VIEW): góc nhìn khi chưa có dữ liệu; không bao giờ mở ra cả thế giới. */
export const DEFAULT_VIEW = VN_VIEW;

export type MapUnavailableReason = 'disabled' | 'no-token' | 'no-webgl' | 'load-failed' | 'timeout';
export type MapConfig = { token: string; style: string };

// `import.meta.env` is absent outside Vite (server-rendered tests): treat it as "no map configured".
const env: ImportMetaEnv = import.meta.env ?? {};
/** `VITE_MAP_ENABLED=false` turns every map into its fallback without touching the rest of the page. */
export const mapEnabled = env.VITE_MAP_ENABLED?.trim().toLowerCase() !== 'false';
/** A URL to a local style JSON (no network) can replace the Mapbox style in tests. */
export const mapStyle = env.VITE_MAP_STYLE?.trim() || DEFAULT_MAP_STYLE;
const token = env.VITE_MAPBOX_TOKEN?.trim() ?? '';

let webgl2: boolean | undefined;
/** Mapbox GL JS v3 needs WebGL 2. */
function hasWebGL2() {
  if (webgl2 === undefined) {
    try { webgl2 = typeof document !== 'undefined' && !!document.createElement('canvas').getContext('webgl2'); } catch { webgl2 = false; }
  }
  return webgl2;
}

export function mapAvailability(): { ok: true; config: MapConfig } | { ok: false; reason: MapUnavailableReason } {
  if (!mapEnabled) return { ok: false, reason: 'disabled' };
  if (!token) return { ok: false, reason: 'no-token' };
  if (!hasWebGL2()) return { ok: false, reason: 'no-webgl' };
  return { ok: true, config: { token, style: mapStyle } };
}

export const unavailableMessage: Record<MapUnavailableReason, string> = {
  disabled: 'Bản đồ đang tạm tắt.',
  'no-token': 'Chưa cấu hình khóa bản đồ.',
  'no-webgl': 'Trình duyệt này không hỗ trợ WebGL 2 nên không hiển thị được bản đồ.',
  'load-failed': 'Không tải được bản đồ.',
  timeout: 'Bản đồ tải quá lâu.',
};

/** Vietnamese labels for the built-in map controls. */
export const MAP_LOCALE = {
  'NavigationControl.ZoomIn': 'Phóng to',
  'NavigationControl.ZoomOut': 'Thu nhỏ',
  'NavigationControl.ResetBearing': 'Xoay về hướng bắc',
  'FullscreenControl.Enter': 'Toàn màn hình',
  'FullscreenControl.Exit': 'Thoát toàn màn hình',
  'ScrollZoomBlocker.CtrlMessage': 'Giữ Ctrl và cuộn để phóng to bản đồ',
  'TouchPanBlocker.Message': 'Dùng hai ngón tay để di chuyển bản đồ',
};

export const formatCoordinate = (value: number) => value.toFixed(6).replace(/\.?0+$/, '');
