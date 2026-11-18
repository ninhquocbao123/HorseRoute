import { useEffect, useRef } from "react";
import { AppState } from "react-native";
import { io, type Socket } from "socket.io-client";
import { API_URL } from "./config";

/** Gốc máy chủ Socket.IO: API_URL bỏ đuôi /api/v1 (giống web, apps/web/src/lib/socket.ts). */
export const SOCKET_URL = API_URL.replace(/\/api\/v1\/?$/, "");

export type RealtimeHandlers = {
  /** Thông báo IN_APP mới của chính người dùng (API phát qua NotificationRelay). */
  onNotification?: (payload: { id: string; eventType?: string | null }) => void;
  /** Mốc hành trình, vị trí, sự cố của chuyến vừa đổi: màn đang mở tải lại. */
  onTripChange?: () => void;
  /** Vừa kết nối lại: dữ liệu có thể đã cũ. */
  onReconnect?: () => void;
};

const TRIP_EVENTS = [
  "tracking:milestone",
  "tracking:position",
  "tracking:incident_updated",
  "tracking:alert",
  "tracking:horse_report",
];

/**
 * Kết nối Socket.IO sẵn có của API bằng token phiên. App về nền thì ngắt, mở lại thì nối lại
 * (khi app chạy nền hoặc đã tắt, thông báo đẩy cần FCM: chưa tích hợp, xem doc/fix_final/hoan_thien_19-11-2026.md).
 */
export function useRealtime(token: string | null, handlers: RealtimeHandlers) {
  const ref = useRef(handlers);
  ref.current = handlers;
  useEffect(() => {
    if (!token) return;
    let socket: Socket | null = null;
    const connect = () => {
      if (socket) return;
      socket = io(SOCKET_URL, {
        transports: ["websocket"],
        auth: { token },
        reconnection: true,
        reconnectionDelay: 1000,
        reconnectionDelayMax: 10000,
      });
      let first = true;
      socket.on("connect", () => {
        if (!first) ref.current.onReconnect?.();
        first = false;
      });
      socket.on("notification:new", (payload: { id: string; eventType?: string | null }) =>
        ref.current.onNotification?.({ ...payload, id: String(payload.id) }),
      );
      for (const event of TRIP_EVENTS) socket.on(event, () => ref.current.onTripChange?.());
    };
    const disconnect = () => {
      socket?.removeAllListeners();
      socket?.disconnect();
      socket = null;
    };
    if (AppState.currentState === "active") connect();
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "active") {
        connect();
        ref.current.onReconnect?.();
      } else disconnect();
    });
    return () => {
      subscription.remove();
      disconnect();
    };
  }, [token]);
}
