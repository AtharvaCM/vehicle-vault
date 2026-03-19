import { IsString, MinLength } from 'class-validator';

export class ReminderIdParamDto {
  @IsString()
  @MinLength(1)
  reminderId!: string;
}
