import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';
import { envValidationSchema } from './config/env.validation';
import { RedisModule } from './infrastructure/redis/redis.module';
import { FirebaseModule } from './infrastructure/firebase/firebase.module';
import { FirebaseAuthGuard } from './common/guards/firebase-auth.guard';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { HealthModule } from './modules/health/health.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validationSchema: envValidationSchema,
      envFilePath: ['.env', '../../.env'],
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (c: ConfigService) => ({
        type: 'mysql' as const,
        host: c.get<string>('DB_HOST'),
        port: c.get<number>('DB_PORT'),
        username: c.get<string>('DB_USER'),
        password: c.get<string>('DB_PASSWORD'),
        database: c.get<string>('DB_NAME'),
        autoLoadEntities: true,
        synchronize: false, // luôn dùng migration
      }),
    }),
    ThrottlerModule.forRoot([{ ttl: 60_000, limit: 100 }]),
    RedisModule,
    FirebaseModule,
    AuthModule,
    UsersModule,
    HealthModule,
  ],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
    { provide: APP_GUARD, useClass: FirebaseAuthGuard },
  ],
})
export class AppModule {}
