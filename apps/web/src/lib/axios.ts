import axios from 'axios';
import { auth } from './firebase';

export const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });

api.interceptors.request.use(async (config) => {
  const token = await auth.currentUser?.getIdToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  async (err) => {
    if (err.response?.status === 401 && auth.currentUser) {
      await auth.signOut();
    }
    return Promise.reject(err);
  },
);
