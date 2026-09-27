import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Settings → Delete account's confirmation: the password, for an account that has one. */
export class AccountDeletionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(72)
  password?: string;
}
