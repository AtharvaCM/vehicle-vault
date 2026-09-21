import { Module } from '@nestjs/common';

import { AuditModule } from '../audit/audit.module';
import { AccountDeletionService } from './account-deletion.service';
import { UsersService } from './users.service';

@Module({
  imports: [AuditModule],
  providers: [UsersService, AccountDeletionService],
  exports: [UsersService, AccountDeletionService],
})
export class UsersModule {}
