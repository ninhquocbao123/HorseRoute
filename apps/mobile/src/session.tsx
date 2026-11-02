import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { AppState } from "react-native";
import * as SecureStore from "expo-secure-store";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { API_URL } from "./config";
import { createApiClient, messageOf } from "./api/http";
import type { IUser } from "./api/types";

type Session = {
  user: IUser | null;
  token: string | null;
  ready: boolean;
  error: string;
  request: ReturnType<typeof createApiClient>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  retrySession: () => Promise<void>;
  revision: number;
  refresh: () => void;
  writing: boolean;
  write: <T>(action: () => Promise<T>) => Promise<T>;
};
const Context = createContext<Session | null>(null);
export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<IUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState("");
  const [revision, setRevision] = useState(0);
  const [writing, setWriting] = useState(false);
  const writeLock = useRef(false);
  const write = async <T,>(action: () => Promise<T>): Promise<T> => {
    if (writeLock.current)
      throw new Error("Đang gửi yêu cầu trước. Vui lòng chờ.");
    writeLock.current = true;
    setWriting(true);
    try {
      return await action();
    } finally {
      writeLock.current = false;
      setWriting(false);
    }
  };
  const tokenRef = useRef<string | null>(null);
  const generation = useRef(0);
  const storageKey = useMemo(
    () => `horseroute.auth.${API_URL.replace(/[^a-zA-Z0-9._-]/g, "_")}`,
    [],
  );
  const expire = useCallback(() => {
    generation.current++;
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setError("Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.");
    void SecureStore.deleteItemAsync(storageKey).catch(() =>
      setError(
        "Phiên đã hết hạn. Không xóa được phiên trên thiết bị; hãy đăng nhập lại.",
      ),
    );
  }, [storageKey]);
  const request = useMemo(
    () =>
      createApiClient({
        baseUrl: API_URL,
        getToken: () => tokenRef.current,
        onUnauthorized: expire,
      }),
    [expire],
  );
  const retrySession = useCallback(async () => {
    setReady(false);
    setError("");
    const run = ++generation.current;
    try {
      const saved = await SecureStore.getItemAsync(storageKey);
      if (run !== generation.current) return;
      tokenRef.current = saved;
      setToken(saved);
      if (saved) {
        const account = await request<IUser>("/users/me");
        if (run === generation.current) setUser(account);
      }
    } catch (e) {
      if (run === generation.current) setError(messageOf(e));
    } finally {
      setReady(true);
    }
  }, [request, storageKey]);
  useEffect(() => {
    void retrySession();
    void AsyncStorage.removeItem("horseroute-design-v1").catch(() => {});
  }, [retrySession]);
  const login = async (email: string, password: string) => {
    const result = await request<{ accessToken: string; user: IUser }>(
      "/auth/login",
      {
        method: "POST",
        anonymous: true,
        body: { email: email.trim(), password },
      },
    );
    await SecureStore.setItemAsync(storageKey, result.accessToken);
    generation.current++;
    tokenRef.current = result.accessToken;
    setToken(result.accessToken);
    setUser(result.user);
    setError("");
    setRevision(0);
  };
  const logout = async () => {
    await SecureStore.deleteItemAsync(storageKey);
    generation.current++;
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setError("");
    setRevision(0);
  };
  const refresh = useCallback(() => setRevision((v) => v + 1), []);
  useEffect(() => {
    if (!user) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") refresh();
    });
    const timer = setInterval(() => {
      if (AppState.currentState === "active") refresh();
    }, 30000);
    return () => {
      subscription.remove();
      clearInterval(timer);
    };
  }, [user, refresh]);
  return (
    <Context.Provider
      value={{
        user,
        token,
        ready,
        error,
        request,
        login,
        logout,
        retrySession,
        revision,
        refresh,
        writing,
        write,
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useSession() {
  const session = useContext(Context);
  if (!session) throw new Error("SessionProvider missing");
  return session;
}
export function useResource<T>(path: string | null) {
  const { request, revision, token } = useSession();
  const [attempt, setAttempt] = useState(0);
  const key = `${token}|${path}`;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error: string;
    loading: boolean;
  }>({ key, error: "", loading: !!path });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    setState((old) => ({
      key,
      data: old.key === key ? old.data : undefined,
      error: "",
      loading: true,
    }));
    request<T>(path, { signal: controller.signal })
      .then((data) => {
        if (!controller.signal.aborted)
          setState({ key, data, loading: false, error: "" });
      })
      .catch((e) => {
        if (!controller.signal.aborted)
          setState((old) => ({
            key,
            data: old.key === key ? old.data : undefined,
            error: messageOf(e),
            loading: false,
          }));
      });
    return () => controller.abort();
  }, [path, key, request, revision, attempt]);
  const current =
    state.key === key ? state : { data: undefined, error: "", loading: !!path };
  return { ...current, reload: () => setAttempt((n) => n + 1) };
}
