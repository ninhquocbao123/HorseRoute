import { DataSource } from 'typeorm';
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

  attach(server: HttpServer, tokens: TokenService, corsOrigin?: string, db?: DataSource) {
    const origins = (corsOrigin || '').split(',').map(s => s.trim()).filter(Boolean);
    this.io = new SocketIOServer(server, {
      cors: {
        origin: origins.length ? origins : '*',
        credentials: true,
      },
      pingTimeout: 30000,
      pingInterval: 15000,
    });

    this.io.use(async (socket: Socket, next) => {
      try {
        const token = socket.handshake.auth?.token || socket.handshake.headers?.authorization?.replace(/^Bearer\s+/i, '');
        if (!token) {
          return next(new Error('AUTHENTICATION_REQUIRED'));
        }
        const payload = tokens.verify(token) as { sub: string; email: string; role: string };
        const [account] = db ? await db.query("SELECT id,role,account_status FROM users WHERE id=?",[payload.sub]) : [];
        if (!account || account.account_status !== 'ACTIVE') return next(new Error('INVALID_ACCOUNT'));
        socket.data.user = {
          id: payload.sub,
          email: payload.email,
          role: account.role,
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
      socket.on('join:order', async (orderId: string, ack?: (result: {ok:boolean})=>void) => {
        const reply = (ok:boolean) => { if(typeof ack === 'function') ack({ok}); };
        if(typeof orderId !== 'string' || !/^[1-9]\d{0,19}$/.test(orderId) || !db) return reply(false);
        try {
          const [order] = await db.query('SELECT customer_id FROM orders WHERE id=?',[orderId]);
          if (!order || !(user.role === 'MANAGER' || (user.role === 'CUSTOMER' && String(order.customer_id) === String(user.id)))) return reply(false);
          if (!socket.connected) return reply(false);
          await socket.join('order:'+orderId);
          reply(true);
        } catch { reply(false); }
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
