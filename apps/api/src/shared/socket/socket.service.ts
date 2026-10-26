import { Server as HttpServer } from 'http';
import { Server as SocketIOServer, Socket } from 'socket.io';
import { TokenService } from '../utils/jwt.util';
import { Logger } from '../utils/logger.util';

const logger = new Logger('SocketService');

export interface PaymentEventPayload {
  orderId: string;
  orderCode?: string;
  customerId: string;
  paymentType: 'DEPOSIT' | 'BALANCE';
  paymentMethod: string;
  amount: number;
  status: 'SUCCESS' | 'FAILED' | 'CANCELLED';
  paid: number;
  total: number;
  balance: number;
  orderStatus?: string;
  message?: string;
}

export class SocketService {
  private io: SocketIOServer | null = null;

  attach(server: HttpServer, tokens: TokenService, corsOrigin?: string) {
    const origins = (corsOrigin || '').split(',').map(s => s.trim()).filter(Boolean);
    this.io = new SocketIOServer(server, {
      cors: {
        origin: origins.length ? origins : '*',
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 15000,
    });

    this.io.use((socket: Socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) {
          return next(new Error('AUTHENTICATION_REQUIRED'));
        }
        const payload = tokens.verify(token) as { sub: string; email: string; role: string };
        socket.data.user = {
          id: payload.sub,
          email: payload.email,
          role: payload.role,
        };
        next();
      } catch (e: any) {
        logger.warn('socket_auth_failed', { error: e.message });
        next(new Error('INVALID_TOKEN'));
      }
    });

    this.io.on('connection', (socket: Socket) => {
      const user = socket.data.user;
      if (!user) {
        socket.disconnect();
        return;
      }

      // Join user personal room and role room
      socket.join(`user:${user.id}`);
      if (user.role) {
        socket.join(`role:${user.role}`);
      }

      logger.info('socket_connected', { socketId: socket.id, userId: user.id, role: user.role });

      // Join / leave specific order room
      socket.on('join:order', (orderId: string) => {
        if (orderId) {
          socket.join(`order:${orderId}`);
          logger.info('socket_joined_order', { socketId: socket.id, orderId });
        }
      });

      socket.on('leave:order', (orderId: string) => {
        if (orderId) {
          socket.leave(`order:${orderId}`);
        }
      });

      socket.on('disconnect', (reason) => {
        logger.info('socket_disconnected', { socketId: socket.id, userId: user.id, reason });
      });
    });
  }

  notifyPayment(payload: PaymentEventPayload) {
    if (!this.io) return;
    logger.info('emit_payment_updated', { orderId: payload.orderId, status: payload.status });

    // Emit to order room, customer user room, and all managers
    this.io.to([`order:${payload.orderId}`, `user:${payload.customerId}`, 'role:MANAGER']).emit('payment:updated', payload);
  }

  /** Phát một sự kiện tới phòng riêng `user:{id}` của từng người (chỉ THÊM, không đổi các sự kiện khác). */
  emitToUsers(userIds: string[], event: string, payload: unknown) {
    if (!this.io || !userIds.length) return;
    this.io.to(userIds.map(id => `user:${id}`)).emit(event, payload);
  }

  notifyOrderStatus(orderId: string, customerId: string, status: string, details?: any) {
    if (!this.io) return;
    this.io.to([`order:${orderId}`, `user:${customerId}`, 'role:MANAGER']).emit('order:status_updated', {
      orderId,
      status,
      ...details,
    });
  }
}

export const socketService = new SocketService();
