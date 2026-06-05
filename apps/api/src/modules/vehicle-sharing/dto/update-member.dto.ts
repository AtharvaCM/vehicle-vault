import { IsIn } from 'class-validator';
import { VehicleRole } from '@prisma/client';

export class UpdateMemberDto {
  @IsIn([VehicleRole.editor, VehicleRole.viewer])
  role!: VehicleRole;
}
