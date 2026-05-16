import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { VehiclesModule } from '../vehicles/vehicles.module';
import { InsuranceAdapter } from './adapters/insurance.adapter';
import { WarrantyAdapter } from './adapters/warranty.adapter';
import { VehicleDocumentsController } from './vehicle-documents.controller';
import { VehicleDocumentsService } from './vehicle-documents.service';
import { VEHICLE_DOCUMENT_ADAPTERS, type VehicleDocumentAdapter } from './types';

@Module({
  imports: [PrismaModule, VehiclesModule],
  controllers: [VehicleDocumentsController],
  providers: [
    VehicleDocumentsService,
    InsuranceAdapter,
    WarrantyAdapter,
    {
      provide: VEHICLE_DOCUMENT_ADAPTERS,
      useFactory: (
        insurance: InsuranceAdapter,
        warranty: WarrantyAdapter,
      ): VehicleDocumentAdapter[] => [insurance, warranty],
      inject: [InsuranceAdapter, WarrantyAdapter],
    },
  ],
  exports: [VehicleDocumentsService],
})
export class VehicleDocumentsModule {}
