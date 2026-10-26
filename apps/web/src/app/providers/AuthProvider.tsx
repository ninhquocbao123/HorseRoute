import { createContext, ReactNode, useCallback, useEffect, useState } from 'react';
import { isAxiosError } from 'axios';
import type { IUser } from '@my-project/shared';
import { queryClient } from '../../lib/queryClient';
import { getMe } from '../../features/users/api/users.api';
import { clearAccessToken, getAccessToken, saveAccessToken } from '../../lib/auth-storage';

interface AuthState {
  account: IUser | null;
  loading: boolean;
  syncError: string;
  logout: () => void;
  onLoginSuccess: (token: string, user: IUser, remember?: boolean) => void;
}

export const AuthContext = createContext<AuthState>({
  account: null,
  loading: true,
  syncError: '',
  logout: () => {},
  onLoginSuccess: () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [account, setAccount] = useState<IUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [syncError, setSyncError] = useState('');

  // Khi app khởi động: nếu có token trong localStorage thì tự động load thông tin user
  useEffect(() => {
    const token = getAccessToken();
    if (!token) {
      setLoading(false);
      return;
    }
    let active = true;
    setLoading(true);
    getMe()
      .then((user) => {
        if (!active || getAccessToken() !== token) return;
        setAccount(user);
        setSyncError('');
      })
      .catch((e) => {
        if (!active || getAccessToken() !== token) return;
        clearAccessToken();
        setSyncError(
          isAxiosError(e) ? 'Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.' : 'Không thể tải thông tin tài khoản.',
        );
      })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  const onLoginSuccess = useCallback((token: string, user: IUser, remember = true) => {
    saveAccessToken(token, remember);
    queryClient.clear();
    setAccount(user);
    setSyncError('');
  }, []);

  const logout = useCallback(() => {
    clearAccessToken();
    queryClient.clear();
    setAccount(null);
  }, []);

  return (
    <AuthContext.Provider value={{ account, loading, syncError, logout, onLoginSuccess }}>
      {children}
    </AuthContext.Provider>
  );
}

