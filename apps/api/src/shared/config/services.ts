import { TripsService } from '../../features/trips/trips.service';
import { TripsRepository } from '../../features/trips/trips.repository';
import { DataSource } from 'typeorm';
import { User } from '../../features/users/users.model';
import { UsersRepository } from '../../features/users/users.repository';
import { UsersService } from '../../features/users/users.service';
import { AuthService } from '../../features/auth/auth.service';
import { OrdersService } from '../../features/orders/orders.service';
import { DocumentsService } from '../../features/documents/documents.service';
import { NotificationsRepository } from '../../features/notifications/notifications.repository';
import { NotificationsService } from '../../features/notifications/notifications.service';
import { HealthService } from '../../features/health/health.service';
import { TokenService } from '../utils/jwt.util';
import { TrackingService } from '../../features/tracking/tracking.service';
import { TrackingRepository } from '../../features/tracking/tracking.repository';
export function createServices(db: DataSource, tokens: TokenService) {
  const users = new UsersService(new UsersRepository(db.getRepository(User)));
  return { trips: new TripsService(new TripsRepository(db)), tracking: new TrackingService(new TrackingRepository(db)), users, auth: new AuthService(users, tokens), orders: new OrdersService(db),
    documents: new DocumentsService(db), notifications: new NotificationsService(new NotificationsRepository(db)),
    health: new HealthService(db) };
}
export type Services = ReturnType<typeof createServices>;

