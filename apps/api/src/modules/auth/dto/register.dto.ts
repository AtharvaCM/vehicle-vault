import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { CATALOG_SLUG_MAX_LENGTH, CATALOG_SLUG_PATTERN } from '@vehicle-vault/shared';
import { IsEmail, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';

export class RegisterDto {
  @ApiProperty({
    description: 'Full name of the user',
    example: 'John Doe',
    maxLength: 120,
  })
  @IsString()
  @MaxLength(120)
  name!: string;

  @ApiProperty({
    description: 'Email address of the user',
    example: 'john.doe@example.com',
    maxLength: 255,
  })
  @IsEmail()
  @MaxLength(255)
  email!: string;

  @ApiProperty({
    description: 'Password of the user',
    example: 'StrongPassword123!',
    minLength: 8,
    maxLength: 72,
  })
  @IsString()
  @MinLength(8)
  @MaxLength(72)
  password!: string;

  @ApiPropertyOptional({
    description:
      'Slug of the catalog model whose public page led to this sign-up. Attribution only.',
    example: 'city',
    maxLength: CATALOG_SLUG_MAX_LENGTH,
  })
  @IsOptional()
  @IsString()
  @MaxLength(CATALOG_SLUG_MAX_LENGTH)
  @Matches(CATALOG_SLUG_PATTERN)
  catalogModel?: string;
}
