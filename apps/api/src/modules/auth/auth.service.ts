import { Injectable } from '@nestjs/common';

@Injectable()
export class AuthService {
  getStatus() {
    return {
      status: 'placeholder',
      message: 'Authentication is intentionally not implemented yet.',
    };
  }
}
