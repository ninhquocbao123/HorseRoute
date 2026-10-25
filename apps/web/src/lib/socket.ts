import { io, Socket } from 'socket.io-client';
import { useEffect, useRef } from 'react';
import { getAccessToken } from './auth-storage';

let socket: Socket | null = null;

export function getSocketBaseUrl(): string {
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000/api/v1';
  return apiUrl.replace(/\/api\/v1\/?$/, '');
}

export function getSocket(): Socket {
  if (!socket) {
    const baseUrl = getSocketBaseUrl();
    socket = io(baseUrl, {
      autoConnect: false,
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      auth: (cb) => {
        const token = getAccessToken();
        cb({ token });
      },
    });
  }
  return socket;
}

export function connectSocket(): Socket {
  const s = getSocket();
  if (!s.connected) {
    s.connect();
  }
  return s;
}

export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}

export interface UseOrderSocketOptions {
  onPaymentUpdate?: (payload: any) => void;
  onStatusUpdate?: (payload: any) => void;
  onReconnect?: () => void;
}

export function useOrderSocket(orderId?: string | null, options: UseOrderSocketOptions = {}) {
  const optionsRef = useRef(options);
  optionsRef.current = options;

  useEffect(() => {
    const token = getAccessToken();
    if (!token) return;

    const s = connectSocket();

    const handleConnect = () => {
      if (orderId) {
        s.emit('join:order', orderId);
      }
      optionsRef.current.onReconnect?.();
    };

    const handlePaymentUpdated = (data: any) => {
      if (!orderId || String(data.orderId) === String(orderId)) {
        optionsRef.current.onPaymentUpdate?.(data);
      }
    };

    const handleStatusUpdated = (data: any) => {
      if (!orderId || String(data.orderId) === String(orderId)) {
        optionsRef.current.onStatusUpdate?.(data);
      }
    };

    s.on('connect', handleConnect);
    s.on('payment:updated', handlePaymentUpdated);
    s.on('order:status_updated', handleStatusUpdated);

    if (s.connected && orderId) {
      s.emit('join:order', orderId);
    }

    return () => {
      if (orderId && s.connected) {
        s.emit('leave:order', orderId);
      }
      s.off('connect', handleConnect);
      s.off('payment:updated', handlePaymentUpdated);
      s.off('order:status_updated', handleStatusUpdated);
    };
  }, [orderId]);
}

