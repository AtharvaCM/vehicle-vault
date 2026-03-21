import { Controller, Get } from '@nestjs/common';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { ExportsService } from './exports.service';

@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Get('account')
  async exportAccount(@CurrentUser() user: AuthUser) {
    const result = await this.exportsService.exportAccount(user.id);

    return successResponse(result.data, result.meta);
  }
}
