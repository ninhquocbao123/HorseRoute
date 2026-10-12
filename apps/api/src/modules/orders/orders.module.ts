import { Module } from '@nestjs/common';
import { UsersModule } from '../users/users.module';
import { OrdersController } from './orders.controller';
import { OrdersService } from './orders.service';
import { NotificationsController } from './notifications.controller';
@Module({ imports: [UsersModule], controllers: [OrdersController, NotificationsController], providers: [OrdersService] })
export class OrdersModule {}
