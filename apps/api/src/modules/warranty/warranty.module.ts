import { Module } from '@nestjs/common';
import { WarrantyController } from './warranty.controller';
import { WarrantyService } from './warranty.service';
import { VehiclesModule } from '../vehicles/vehicles.module';

@Module({
  imports: [VehiclesModule],
  controllers: [WarrantyController],
  providers: [WarrantyService],
  exports: [WarrantyService],
})
export class WarrantyModule {}
