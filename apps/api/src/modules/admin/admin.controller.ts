import { Controller, Get, Param, ParseUUIDPipe, Post, Query, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { Roles } from '../../common/auth/decorators/roles.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/auth/guards/roles.guard';
import { successResponse } from '../../common/utils/api-response.util';
import { AdminService } from './admin.service';
import { ListAdminUsersQueryDto } from './dto/list-users-query.dto';

@ApiTags('Admin')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Roles('admin')
@Controller('admin')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @Get('users')
  @ApiOperation({ summary: 'List users with optional search + pagination (admin only)' })
  async listUsers(@Query() query: ListAdminUsersQueryDto) {
    const result = await this.adminService.listUsers({
      search: query.search,
      page: query.page,
      limit: query.limit,
    });
    return successResponse(result);
  }

  @Post('users/:userId/force-logout')
  @ApiOperation({
    summary: 'Invalidate target user refresh token; next refresh attempt fails (admin only)',
  })
  async forceLogout(
    @Param('userId', new ParseUUIDPipe()) userId: string,
    @CurrentUser() admin: AuthUser,
  ) {
    return successResponse(await this.adminService.forceLogout(admin.id, userId));
  }
}
