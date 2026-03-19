import { Injectable } from '@nestjs/common';

@Injectable()
export class HealthService {
  getHealth() {
    return {
      status: 'ok',
      service: 'vehicle-vault-api',
      timestamp: new Date().toISOString(),
    };
  }
}
