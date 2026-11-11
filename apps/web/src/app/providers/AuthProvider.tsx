import { disconnectSocket } from '../../lib/socket';
import { createContext, ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { isAxiosError } from 'axios';
import type { IUser } from '@my-project/shared';
import { queryClient } from '../../lib/queryClient';
import { getMe } from '../../features/users/api/users.api';
import { clearAccessToken, getAccessToken, saveAccessToken } from '../../lib/auth-storage';
import { ME_RETRIES, meFailure, retryDelay } from '../../lib/auth-errors';

interface AuthState {
  account: IUser | null;
  loading: boolean;
  syncError: string;
  /** Còn phiên (token) nhưng chưa tải được tài khoản vì lỗi tạm thời: hiện màn thử lại thay vì đưa về đăng nhập. */
  offline: boolean;
  retrySync: () => void;
  logout: () => void;
  updateAccount: (user: IUser) => void;
  onLoginSuccess: (token: string, user: IUser, remember?: boolean) => void;
}

export const AuthContext = createContext<AuthState>({
  account: null,
  loading: true,
  syncError: '',
  offline: false,
  retrySync: () => {},
  logout: () => {},
  updateAccount: () => {},
  onLoginSuccess: () => {},
});

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');
  const [offline, setOffline] = useState(false);
  const run = useRef(0);

  // Khi app khởi động: nếu có token thì tải thông tin tài khoản. Lỗi tạm thời (429, 5xx, mất mạng) không đăng xuất.
  const sync = useCallback(async () => {
    const token = getAccessToken();
    const id = ++run.current;
    if (!token) { setLoading(false); return; }
    setLoading(true);
    setOffline(false);
    for (let attempt = 0; ; attempt++) {
      try {
        const user = await getMe();
        if (id !== run.current || getAccessToken() !== token) return;
        setAccount(user);
        setSyncError('');
        break;
      } catch (e) {
        if (id !== run.current || getAccessToken() !== token) return;
        const response = isAxiosError(e) ? e.response : undefined;
        if (isAxiosError(e) && meFailure(response?.status) === 'expired') {
          disconnectSocket();
          clearAccessToken();
          setSyncError('Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.');
          break;
        }
        if (attempt >= ME_RETRIES) {
          setOffline(true);
          setSyncError(response?.status === 429
            ? 'Máy chủ đang nhận quá nhiều yêu cầu. Bạn vẫn đang đăng nhập, hãy thử lại sau ít phút.'
            : 'Chưa kết nối được máy chủ. Bạn vẫn đang đăng nhập, hãy kiểm tra mạng rồi thử lại.');
          break;
        }
        await wait(retryDelay(attempt, response?.headers?.['retry-after']));
        if (id !== run.current) return;
      }
    }
    if (id === run.current) setLoading(false);
  }, []);

  useEffect(() => { void sync(); return () => { run.current++; }; }, [sync]);

  const onLoginSuccess = useCallback((token: string, user: IUser, remember = true) => {
    run.current++;
    disconnectSocket();
    saveAccessToken(token, remember);
    queryClient.clear();
    setAccount(user);
    setSyncError('');
    setOffline(false);
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    run.current++;
    disconnectSocket();
    clearAccessToken();
    queryClient.clear();
    setAccount(null);
    setOffline(false);
    setLoading(false);
  }, []);

  const retrySync = useCallback(() => { void sync(); }, [sync]);

  return (
    <AuthContext.Provider value={{ account, loading, syncError, offline, retrySync, logout, onLoginSuccess, updateAccount: setAccount }}>
      {children}
    </AuthContext.Provider>
  );
}
