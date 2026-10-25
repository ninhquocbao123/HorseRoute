import axios from 'axios';
import { clearAccessToken, getAccessToken } from './auth-storage';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

// Đính kèm JWT token từ localStorage vào mọi request
api.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// Nếu token hết hạn (401) → xóa token, reload trang về login
api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401 && !['/auth/login', '/auth/register'].includes(err.config?.url)) {
      clearAccessToken();
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

