// Realtime của khung tài xế (UI-2): nghe 3 sự kiện trên phòng user:{id} qua socket dùng chung (lib/socket.ts, chỉ dùng, không sửa).
// Mất kết nối → tải lại cảnh báo mỗi 60 giây khi tab đang hiển thị; kết nối lại → tải lại cảnh báo + thông báo một lần.
import { useEffect, useRef, useState } from 'react';
import { connectSocket } from '../../../lib/socket';
import { getAccessToken } from '../../../lib/auth-storage';

export const POLL_MS = 60_000;

export type RealtimeAlert = { alertId: string; tripId: string; alertType: string; content: string; sentByName: string; sentAt: string };
export type RealtimeIncident = { incidentId: string; tripId: string; status: string; handlingNote: string | null };
export type RealtimeHorseReportViewed = { reportId: string; viewedAt: string };
export type RealtimeNotification = { id: string; content: string; createdAt: string; eventType?: string };

export type RealtimeHandlers = {
  onAlert: (payload: RealtimeAlert) => void;
  onIncidentUpdated: (payload: RealtimeIncident) => void;
  onNotification: (payload: RealtimeNotification) => void;
  /** Hộ tống: khách vừa mở một báo cáo sức khỏe do mình gửi. */
  onHorseReportViewed?: (payload: RealtimeHorseReportViewed) => void;
  /** Polling khi mất kết nối: tải lại cảnh báo. */
  onPoll: () => void;
  /** Kết nối lại: tải lại cảnh báo + thông báo. */
  onResync: () => void;
};

declare global {
  interface Window { __wdpRealtime?: { emit: (event: string, payload: unknown) => void; setConnected: (connected: boolean) => void } }
}

export function useDriverRealtime(handlers: RealtimeHandlers, enabled = true) {
  const ref = useRef(handlers);
  ref.current = handlers;
  const [connected, setConnected] = useState(false);
  const everConnected = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    const alert = (p: RealtimeAlert) => ref.current.onAlert(p);
    const incident = (p: RealtimeIncident) => ref.current.onIncidentUpdated(p);
    const notice = (p: RealtimeNotification) => ref.current.onNotification(p);
    const viewed = (p: RealtimeHorseReportViewed) => ref.current.onHorseReportViewed?.(p);
    const up = () => {
      setConnected(true);
      if (everConnected.current) ref.current.onResync();
      everConnected.current = true;
    };
    const down = () => setConnected(false);
    // Móc kiểm thử (chỉ build dev): phát sự kiện giả và giả lập mất/có kết nối mà không cần server socket.
    if (import.meta.env.DEV) {
      const byEvent: Record<string, (payload: never) => void> = { 'tracking:alert': alert, 'tracking:incident_updated': incident, 'notification:new': notice, 'tracking:horse_report_viewed': viewed };
      window.__wdpRealtime = {
        emit: (event, payload) => byEvent[event]?.(payload as never),
        setConnected: value => (value ? up() : down()),
      };
    }
    const socket = getAccessToken() ? connectSocket() : null;
    if (socket) {
      socket.on('tracking:alert', alert);
      socket.on('tracking:incident_updated', incident);
      socket.on('notification:new', notice);
      socket.on('tracking:horse_report_viewed', viewed);
      socket.on('connect', up);
      socket.on('disconnect', down);
      setConnected(socket.connected);
      if (socket.connected) everConnected.current = true;
    }
    return () => {
      if (socket) {
        socket.off('tracking:alert', alert);
        socket.off('tracking:incident_updated', incident);
        socket.off('notification:new', notice);
        socket.off('tracking:horse_report_viewed', viewed);
        socket.off('connect', up);
        socket.off('disconnect', down);
      }
      if (import.meta.env.DEV) delete window.__wdpRealtime;
    };
  }, [enabled]);

  useEffect(() => {
    if (!enabled || connected) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === 'visible') ref.current.onPoll();
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [enabled, connected]);

  return { connected };
}
