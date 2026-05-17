import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFiles,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import {
  ATTACHMENTS_MAX_FILES,
  ATTACHMENTS_MAX_FILE_SIZE_BYTES,
} from '../attachments/constants/attachment.constants';
import type { AttachmentUploadFile } from '../attachments/types/attachment-upload-file.type';
import { attachmentFileFilter } from '../attachments/utils/attachment-upload.util';
import { ClaimAttachmentsService } from './claim-attachments.service';

@Controller()
@UseGuards(JwtAuthGuard)
export class ClaimAttachmentsController {
  constructor(private readonly claimAttachmentsService: ClaimAttachmentsService) {}

  @Get('claim-attachments/extraction/status')
  async getExtractionStatus() {
    return this.claimAttachmentsService.getExtractionStatus();
  }

  @Get('claims/:claimId/attachments')
  async list(@Param('claimId') claimId: string, @CurrentUser() user: AuthUser) {
    return this.claimAttachmentsService.listByClaim(user.id, claimId);
  }

  @Post('claims/:claimId/attachments')
  @UseInterceptors(
    FilesInterceptor('files', ATTACHMENTS_MAX_FILES, {
      limits: { fileSize: ATTACHMENTS_MAX_FILE_SIZE_BYTES },
      fileFilter: attachmentFileFilter,
    }),
  )
  async upload(
    @Param('claimId') claimId: string,
    @UploadedFiles() files: AttachmentUploadFile[],
    @CurrentUser() user: AuthUser,
  ) {
    return this.claimAttachmentsService.upload(user.id, claimId, files ?? []);
  }

  @Get('claim-attachments/:attachmentId/file')
  async getFile(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true })
    response: { setHeader: (name: string, value: string) => void },
  ) {
    const attachment = await this.claimAttachmentsService.getFile(user.id, attachmentId);
    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.originalFileName)}"`,
    );
    return new StreamableFile(attachment.fileBuffer);
  }

  @Post('claim-attachments/:attachmentId/extract')
  async extract(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.claimAttachmentsService.extractFromAttachment(user.id, attachmentId);
  }

  @Delete('claim-attachments/:attachmentId')
  async remove(
    @Param('attachmentId') attachmentId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return this.claimAttachmentsService.remove(user.id, attachmentId);
  }
}
