import { Module } from '@nestjs/common';

import { PrismaModule } from '../../common/prisma/prisma.module';
import { ReportsController } from './reports.controller';
import { ResaleReportService } from './resale-report.service';
import { ServiceHistoryService } from './service-history.service';

@Module({
  imports: [PrismaModule],
  controllers: [ReportsController],
  providers: [ServiceHistoryService, ResaleReportService],
})
export class ReportsModule {}
