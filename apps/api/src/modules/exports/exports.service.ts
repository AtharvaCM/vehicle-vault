import { Injectable } from '@nestjs/common';

@Injectable()
export class ExportsService {
  getPlaceholderStatus() {
    return {
      status: 'not-implemented',
      message: 'Exports will be added once CSV/PDF reporting requirements are defined.',
    };
  }
}
