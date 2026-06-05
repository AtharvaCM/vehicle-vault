import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import { AcceptInviteDto } from './dto/accept-invite.dto';
import { CreateInviteDto } from './dto/create-invite.dto';
import { TransferOwnershipDto } from './dto/transfer-ownership.dto';
import { UpdateMemberDto } from './dto/update-member.dto';
import { VehicleInvitesService } from './vehicle-invites.service';
import { VehicleMembersService } from './vehicle-members.service';

@ApiTags('Vehicle sharing')
@ApiBearerAuth()
@Controller()
export class VehicleSharingController {
  constructor(
    private readonly invitesService: VehicleInvitesService,
    private readonly membersService: VehicleMembersService,
  ) {}

  @Get('vehicles/:vehicleId/members')
  @ApiOperation({ summary: 'List members of a shared vehicle' })
  async listMembers(
    @CurrentUser() user: AuthUser,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
  ) {
    const data = await this.membersService.list(user.id, vehicleId);
    return successResponse(data);
  }

  @Patch('vehicles/:vehicleId/members/:memberId')
  @ApiOperation({ summary: 'Change a member role (owner only, non-owner roles)' })
  async updateMember(
    @CurrentUser() user: AuthUser,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
    @Body() body: UpdateMemberDto,
  ) {
    return this.membersService.updateRole(user.id, vehicleId, memberId, body.role);
  }

  @Delete('vehicles/:vehicleId/members/:memberId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Remove a member or leave a shared vehicle' })
  async removeMember(
    @CurrentUser() user: AuthUser,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Param('memberId', new ParseUUIDPipe()) memberId: string,
  ) {
    await this.membersService.remove(user.id, vehicleId, memberId);
  }

  @Post('vehicles/:vehicleId/transfer-ownership')
  @HttpCode(204)
  @ApiOperation({ summary: 'Transfer ownership of a vehicle to another member' })
  async transferOwnership(
    @CurrentUser() user: AuthUser,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Body() body: TransferOwnershipDto,
  ) {
    await this.membersService.transferOwnership(user.id, vehicleId, body.memberId);
  }

  @Get('vehicles/:vehicleId/invites')
  @ApiOperation({ summary: 'List invitations for a vehicle (owner only)' })
  async listInvites(
    @CurrentUser() user: AuthUser,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
  ) {
    const data = await this.invitesService.listForVehicle(user.id, vehicleId);
    return successResponse(data);
  }

  @Post('vehicles/:vehicleId/invites')
  @ApiOperation({ summary: 'Invite a user to a vehicle (owner only)' })
  async createInvite(
    @CurrentUser() user: AuthUser,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Body() body: CreateInviteDto,
  ) {
    return this.invitesService.createInvite(user.id, vehicleId, body);
  }

  @Delete('vehicles/:vehicleId/invites/:inviteId')
  @HttpCode(204)
  @ApiOperation({ summary: 'Revoke a pending invitation (owner only)' })
  async revokeInvite(
    @CurrentUser() user: AuthUser,
    @Param('vehicleId', new ParseUUIDPipe()) vehicleId: string,
    @Param('inviteId', new ParseUUIDPipe()) inviteId: string,
  ) {
    await this.invitesService.revoke(user.id, vehicleId, inviteId);
  }

  @Post('vehicle-invites/accept')
  @ApiOperation({ summary: 'Accept a vehicle invitation by token' })
  async acceptInvite(@CurrentUser() user: AuthUser, @Body() body: AcceptInviteDto) {
    return this.invitesService.accept(user.id, body.token);
  }
}
