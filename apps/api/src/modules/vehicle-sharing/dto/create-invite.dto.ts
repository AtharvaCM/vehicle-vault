import { IsEmail, IsIn, MaxLength } from 'class-validator';
import { VehicleRole } from '@prisma/client';

export class CreateInviteDto {
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @IsIn([VehicleRole.editor, VehicleRole.viewer])
  role!: VehicleRole;
}
