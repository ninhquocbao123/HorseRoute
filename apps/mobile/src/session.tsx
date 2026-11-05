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
import { API_URL, AUTH_KEY } from "./config";
import { ApiError, createApiClient, messageOf } from "./api/http";
import { configureQueue, initQueue, onRejected, onSent } from "./queue";
import type { IUser } from "./api/types";

type Session = {
  user: IUser | null;
  token: string | null;
  ready: boolean;
  error: string;
  request: ReturnType<typeof createApiClient>;
  login: (email: string, password: string) => Promise<IUser>;
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
  const storageKey = AUTH_KEY;
  // Hồ sơ người dùng lưu kèm phiên: mở app khi mất sóng vẫn vào được chuyến (F-C3).
  const userKey = `${storageKey}.user`;
  const expire = useCallback(() => {
    generation.current++;
    tokenRef.current = null;
    setToken(null);
    setUser(null);
    setError(
      "Phiên đăng nhập đã hết hạn. Đăng nhập lại để tiếp tục; những mục chưa gửi vẫn được giữ.",
    );
    void SecureStore.deleteItemAsync(userKey).catch(() => {});
    void SecureStore.deleteItemAsync(storageKey).catch(() =>
      setError(
        "Phiên đã hết hạn. Không xóa được phiên trên thiết bị; hãy đăng nhập lại.",
      ),
    );
  }, [storageKey, userKey]);
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
        void SecureStore.setItemAsync(userKey, JSON.stringify(account)).catch(
          () => {},
        );
      }
    } catch (e) {
      if (run !== generation.current) return;
      const cached =
        e instanceof ApiError && e.status === 0
          ? await SecureStore.getItemAsync(userKey).catch(() => null)
          : null;
      if (cached) setUser(JSON.parse(cached) as IUser);
      else setError(messageOf(e));
    } finally {
      setReady(true);
    }
  }, [request, storageKey, userKey]);
  useEffect(() => {
    void initQueue();
  }, []);
  useEffect(() => {
    configureQueue(user ? request : null, user ? String(user.id) : null);
  }, [user, request]);
  useEffect(() => {
    void retrySession();
    void AsyncStorage.removeItem("horseroute-design-v1").catch(() => {});
  }, [retrySession]);
  const login = async (email: string, password: string): Promise<IUser> => {
    const result = await request<{ accessToken: string; user: IUser }>(
      "/auth/login",
      {
        method: "POST",
        anonymous: true,
        body: { email: email.trim(), password },
      },
    );
    await SecureStore.setItemAsync(storageKey, result.accessToken);
    void SecureStore.setItemAsync(userKey, JSON.stringify(result.user)).catch(
      () => {},
    );
    generation.current++;
    tokenRef.current = result.accessToken;
    setToken(result.accessToken);
    setUser(result.user);
    setError("");
    setRevision(0);
    return result.user;
  };
  const logout = async () => {
    await SecureStore.deleteItemAsync(userKey).catch(() => {});
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
    // Mục trong hàng chờ vừa có kết quả: dữ liệu trên màn đã cũ, không đợi nhịp 30 giây.
    const offSent = onSent(refresh);
    const offRejected = onRejected(refresh);
    return () => {
      offSent();
      offRejected();
    };
  }, [refresh]);
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
const cacheKey = (userId: string, path: string) =>
  `horseroute.cache.${userId}.${path}`;

/**
 * Tải dữ liệu theo đường dẫn API. Lần tải thành công được lưu trên máy;
 * mất sóng thì dùng bản đã lưu và ghi rõ giờ (F-C3).
 */
export function useResource<T>(path: string | null) {
  const { request, revision, token, user } = useSession();
  const [attempt, setAttempt] = useState(0);
  const key = `${token}|${path}`;
  const [state, setState] = useState<{
    key: string;
    data?: T;
    error: string;
    loading: boolean;
    cachedAt?: number;
  }>({ key, error: "", loading: !!path });
  useEffect(() => {
    if (!path) return;
    const controller = new AbortController();
    const store = user ? cacheKey(String(user.id), path) : null;
    setState((old) => ({
      key,
      data: old.key === key ? old.data : undefined,
      cachedAt: old.key === key ? old.cachedAt : undefined,
      error: "",
      loading: true,
    }));
    request<T>(path, { signal: controller.signal })
      .then((data) => {
        if (controller.signal.aborted) return;
        setState({ key, data, loading: false, error: "" });
        if (store)
          void AsyncStorage.setItem(
            store,
            JSON.stringify({ at: Date.now(), data }),
          ).catch(() => {});
      })
      .catch(async (e) => {
        if (controller.signal.aborted) return;
        const offline = e instanceof ApiError && e.status === 0;
        const raw =
          offline && store
            ? await AsyncStorage.getItem(store).catch(() => null)
            : null;
        const cached = raw
          ? (JSON.parse(raw) as { at: number; data: T })
          : null;
        if (controller.signal.aborted) return;
        setState((old) => ({
          key,
          data:
            old.key === key && old.data !== undefined ? old.data : cached?.data,
          cachedAt:
            old.key === key && old.data !== undefined
              ? old.cachedAt
              : cached?.at,
          error: messageOf(e),
          loading: false,
        }));
      });
    return () => controller.abort();
  }, [path, key, request, revision, attempt, user]);
  const current =
    state.key === key ? state : { data: undefined, error: "", loading: !!path };
  return { ...current, reload: () => setAttempt((n) => n + 1) };
}
