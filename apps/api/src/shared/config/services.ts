import { CustomerService } from '../../features/customer/customer.service';
import { SpecialistService } from '../../features/specialist/specialist.service';
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
import { VehiclesService } from '../../features/vehicles/vehicles.service';
import { VehiclesRepository } from '../../features/vehicles/vehicles.repository';
import { TrackingService } from '../../features/tracking/tracking.service';
import { TrackingRepository } from '../../features/tracking/tracking.repository';
import { LocationsService } from '../../features/locations/locations.service';
import { LocationsRepository } from '../../features/locations/locations.repository';
import { PricingService } from '../../features/pricing/pricing.service';
import { ManagerService } from '../../features/manager/manager.service';
import { PaymentsService } from '../../features/payments/payments.service';

export function createServices(db: DataSource, tokens: TokenService) {
  const users = new UsersService(new UsersRepository(db.getRepository(User)));
  return {
    customer: new CustomerService(db),
    trips: new TripsService(new TripsRepository(db)),
    vehicles: new VehiclesService(new VehiclesRepository(db)),
    locations: new LocationsService(new LocationsRepository(db)),
    tracking: new TrackingService(new TrackingRepository(db)),
    users,
    auth: new AuthService(users, tokens),
    orders: new OrdersService(db),
    documents: new DocumentsService(db),
    notifications: new NotificationsService(new NotificationsRepository(db)),
    health: new HealthService(db),
    pricing: new PricingService(db),
    manager: new ManagerService(db),
    specialist: new SpecialistService(db),
    payments: new PaymentsService(db),
  };
}

export type Services = ReturnType<typeof createServices>;
