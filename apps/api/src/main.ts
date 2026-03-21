import 'reflect-metadata';

import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { API_PREFIX } from './common/constants/app.constants';
import { GlobalExceptionFilter } from './common/filters/global-exception.filter';
import { ApiResponseInterceptor } from './common/interceptors/api-response.interceptor';
import { AppModule } from './app.module';
import { AppConfigService } from './config/app-config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const appConfig = app.get(AppConfigService);
  const port = appConfig.port;
  const allowedOrigins = new Set(appConfig.frontendOrigins);
  const allowedOriginPattern = appConfig.frontendOriginPattern;
  const corsOrigin:
    | true
    | ((origin: string | undefined, callback: (error: Error | null, allow?: boolean) => void) => void) =
    appConfig.isProduction
    ? (origin, callback) => {
        if (
          !origin ||
          allowedOrigins.has(origin) ||
          (allowedOriginPattern ? allowedOriginPattern.test(origin) : false)
        ) {
          callback(null, true);
          return;
        }

        callback(new Error('Origin not allowed by CORS'), false);
      }
    : true;

  app.setGlobalPrefix(API_PREFIX);
  app.enableCors({
    origin: corsOrigin,
    credentials: true,
  });
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
      forbidNonWhitelisted: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    }),
  );
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ApiResponseInterceptor());

  await app.listen(port);
  Logger.log(`API listening on http://localhost:${port}/${API_PREFIX}`, 'Bootstrap');
}

void bootstrap();
