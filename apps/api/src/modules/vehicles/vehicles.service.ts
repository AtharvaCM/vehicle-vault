import { Injectable } from '@nestjs/common';
import { VehicleType } from '@vehicle-vault/shared';

@Injectable()
export class VehiclesService {
  listVehicles() {
    return {
      data: [],
      supportedTypes: Object.values(VehicleType),
    };
  }
}
