import { IsString, MinLength } from 'class-validator';

export class AccessoryIdParamDto {
  @IsString()
  @MinLength(1)
  accessoryId!: string;
}
