import { createContext, ReactNode, useEffect, useState } from 'react';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth } from '../../lib/firebase';
import { syncUser } from '../../features/users/api/users.api';

interface AuthState {
  user: User | null;
  loading: boolean;
}

export const AuthContext = createContext<AuthState>({ user: null, loading: true });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AuthState>({ user: null, loading: true });

  useEffect(
    () =>
      onAuthStateChanged(auth, async (user) => {
        if (user) {
          try {
            await syncUser(); // đồng bộ user vào MySQL
          } catch (e) {
            console.error('Sync user failed', e);
          }
        }
        setState({ user, loading: false });
      }),
    [],
  );

  return <AuthContext.Provider value={state}>{children}</AuthContext.Provider>;
}
