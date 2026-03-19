import { IsString, MinLength } from 'class-validator';

export class VehicleIdParamDto {
  @IsString()
  @MinLength(1)
  vehicleId!: string;
}
