import axios, { type InternalAxiosRequestConfig } from 'axios';
import { trackRequest } from './network';
import { clearAccessToken, getAccessToken } from './auth-storage';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Đính kèm JWT token từ localStorage vào mọi request
type Tracked = InternalAxiosRequestConfig & { _done?: (reached: boolean) => void };

api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  // Banner mạng: theo dõi request chậm hoặc không tới được máy chủ.
  (config as Tracked)._done = trackRequest();
  return config;
});

// Nếu token hết hạn (401) → xóa token, reload trang về login
api.interceptors.response.use(
  (res) => { (res.config as Tracked)._done?.(true); return res; },
  (err) => {
    // Bị hủy (đổi trang, AbortController) không tính là mất kết nối.
    (err.config as Tracked | undefined)?._done?.(!!err.response || axios.isCancel(err) || err.code === 'ERR_CANCELED');
    // Các lệnh /auth/* tự báo lỗi trên form, không chuyển trang.
    if (err.response?.status === 401 && !String(err.config?.url ?? '').startsWith('/auth/')) {
      clearAccessToken();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

