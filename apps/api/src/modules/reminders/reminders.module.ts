import { Module } from '@nestjs/common';

import { VehiclesModule } from '../vehicles/vehicles.module';
import { RemindersController } from './reminders.controller';
import { RemindersService } from './reminders.service';

@Module({
  imports: [VehiclesModule],
  controllers: [RemindersController],
  providers: [RemindersService],
})
export class RemindersModule {}
