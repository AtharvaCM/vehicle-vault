import { Module } from '@nestjs/common';

import { VehiclesModule } from '../vehicles/vehicles.module';
import { PublicCatalogController } from './public-catalog.controller';
import { PublicCatalogService } from './public-catalog.service';

@Module({
  imports: [VehiclesModule],
  controllers: [PublicCatalogController],
  providers: [PublicCatalogService],
})
export class PublicCatalogModule {}
