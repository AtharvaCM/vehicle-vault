import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Settings → Security's password change: the same length rules as sign-up and reset. */
export class PasswordChangeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  currentPassword?: string;

  @IsString()
  @MinLength(8)
  @MaxLength(72)
  newPassword!: string;
}
