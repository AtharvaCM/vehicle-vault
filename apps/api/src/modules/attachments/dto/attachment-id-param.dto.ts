import { IsString, MinLength } from 'class-validator';

export class AttachmentIdParamDto {
  @IsString()
  @MinLength(1)
  attachmentId!: string;
}
