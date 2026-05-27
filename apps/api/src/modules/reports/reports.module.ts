import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ServiceHistoryService } from './service-history.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ServiceHistoryService],
})
export class ReportsModule {}
