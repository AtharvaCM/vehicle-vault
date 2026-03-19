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

  get frontendOrigin() {
    return this.configService.get<string>('app.frontendOrigin') ?? DEFAULT_FRONTEND_ORIGIN;
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

  get nodeEnv(): NodeEnv {
    return this.configService.get<NodeEnv>('app.nodeEnv') ?? 'development';
  }

  get isProduction() {
    return this.nodeEnv === 'production';
  }
}
