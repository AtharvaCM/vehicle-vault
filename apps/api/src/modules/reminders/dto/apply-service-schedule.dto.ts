import { ArrayMinSize, ArrayNotEmpty, IsArray, IsString } from 'class-validator';

export class ApplyServiceScheduleDto {
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMinSize(1)
  @IsString({ each: true })
  slugs!: string[];
}
