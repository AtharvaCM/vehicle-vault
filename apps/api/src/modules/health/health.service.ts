import { Injectable } from '@nestjs/common';

import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class HealthService {
  constructor(private readonly appConfig: AppConfigService) {}

  getHealth() {
    return {
      status: 'ok',
      service: 'vehicle-vault-api',
      environment: this.appConfig.nodeEnv,
      timestamp: new Date().toISOString(),
      uptime: Math.round(process.uptime()),
    };
  }
}
