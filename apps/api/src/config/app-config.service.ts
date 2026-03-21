import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { DEFAULT_APP_PORT, DEFAULT_FRONTEND_ORIGIN } from '../common/constants/app.constants';
import type { NodeEnv } from '../common/types/node-env.type';

@Injectable()
export class AppConfigService {
  constructor(private readonly configService: ConfigService) {}

  get port() {
    return this.configService.get<number>('app.port') ?? DEFAULT_APP_PORT;
  }

  get frontendOrigins() {
    return this.configService.get<string[]>('app.frontendOrigins') ?? [DEFAULT_FRONTEND_ORIGIN];
  }

  get frontendOrigin() {
    return this.frontendOrigins[0] ?? DEFAULT_FRONTEND_ORIGIN;
  }

  get databaseUrl() {
    return (
      this.configService.get<string>('app.databaseUrl') ??
      'postgresql://postgres:postgres@localhost:5432/vehicle_vault?schema=public'
    );
  }

  get jwtSecret() {
    return this.configService.get<string>('app.jwtSecret') ?? 'vehicle-vault-dev-secret';
  }

  get jwtExpiresIn() {
    return this.configService.get<string>('app.jwtExpiresIn') ?? '7d';
  }

  get jwtRefreshSecret() {
    return this.configService.get<string>('app.jwtRefreshSecret') ?? 'vehicle-vault-dev-refresh-secret';
  }

  get jwtRefreshExpiresIn() {
    return this.configService.get<string>('app.jwtRefreshExpiresIn') ?? '30d';
  }

  get nodeEnv(): NodeEnv {
    return this.configService.get<NodeEnv>('app.nodeEnv') ?? 'development';
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }
}
