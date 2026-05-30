import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AdminController } from './admin.controller';
import { AdminRoleBootstrapService } from './admin-role-bootstrap.service';
import { AdminService } from './admin.service';

@Module({
  imports: [AuditModule],
  controllers: [AdminController],
  providers: [AdminService, AdminRoleBootstrapService],
})
export class AdminModule {}
