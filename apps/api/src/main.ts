import 'reflect-metadata';
import { NestFactory } from '@nestjs/core';
import { ValidationPipe, VersioningType } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import compression from 'compression';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/all-exceptions.filter';
import { validationException } from './common/dto/validation-errors';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const config = app.get(ConfigService);

  app.use(helmet());
  app.use(compression());
  app.enableCors({ origin: config.get<string>('CORS_ORIGIN')?.split(','), credentials: true });
  app.setGlobalPrefix('api');
  app.enableVersioning({ type: VersioningType.URI, defaultVersion: '1' });
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true, forbidNonWhitelisted: true, exceptionFactory: validationException }));
  app.useGlobalFilters(new AllExceptionsFilter());
  app.enableShutdownHooks();

  if (config.get('NODE_ENV') !== 'production') {
    const doc = new DocumentBuilder().setTitle('WDP Equine Transport API').setDescription('Đăng ký / đăng nhập tại Authentication. Sao chép accessToken vào Authorize. Flow 1: tạo nháp → gửi duyệt → Manager duyệt hoặc yêu cầu bổ sung.').setVersion('1.0').addBearerAuth().build();
    SwaggerModule.setup('docs', app, SwaggerModule.createDocument(app, doc));
  }

  await app.listen(config.get<number>('PORT') ?? 3000);
}
bootstrap();

