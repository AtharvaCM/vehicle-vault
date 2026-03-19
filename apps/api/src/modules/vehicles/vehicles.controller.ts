import { Controller, Get } from '@nestjs/common';

import { VehiclesService } from './vehicles.service';

@Controller('vehicles')
export class VehiclesController {
  constructor(private readonly vehiclesService: VehiclesService) {}

  @Get()
  listVehicles() {
    return this.vehiclesService.listVehicles();
  }
}
