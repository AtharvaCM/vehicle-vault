import { Injectable } from '@nestjs/common';

import type { AuthStatus } from './auth.types';

@Injectable()
export class AuthService {
  getStatus(): AuthStatus {
    return {
      status: 'placeholder',
      message: 'Authentication is intentionally not implemented yet.',
      strategies: [],
    };
  }
}
