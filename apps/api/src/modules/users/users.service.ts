import { Injectable } from '@nestjs/common';

@Injectable()
export class UsersService {
  getPlaceholderStatus() {
    return {
      status: 'not-implemented',
      message: 'Users module is reserved for future account and ownership flows.',
    };
  }
}
