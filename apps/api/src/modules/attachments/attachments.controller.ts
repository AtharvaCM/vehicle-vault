import {
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Res,
  StreamableFile,
  UploadedFiles,
  UseInterceptors,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import type { AuthUser } from '@vehicle-vault/shared';

import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { successResponse } from '../../common/utils/api-response.util';
import {
  ATTACHMENTS_MAX_FILES,
  ATTACHMENTS_MAX_FILE_SIZE_BYTES,
} from './constants/attachment.constants';
import { AttachmentIdParamDto } from './dto/attachment-id-param.dto';
import { MaintenanceRecordIdParamDto } from './dto/maintenance-record-id-param.dto';
import { AttachmentsService } from './attachments.service';
import type { AttachmentUploadFile } from './types/attachment-upload-file.type';
import { attachmentFileFilter } from './utils/attachment-upload.util';

@Controller()
export class AttachmentsController {
  constructor(private readonly attachmentsService: AttachmentsService) {}

  @Get('attachments/extraction/status')
  async getExtractionStatus() {
    return successResponse(this.attachmentsService.getExtractionStatus());
  }

  @Get('maintenance-records/:recordId/attachments')
  async listAttachments(
    @Param() params: MaintenanceRecordIdParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.attachmentsService.listByMaintenanceRecord(user.id, params.recordId),
    );
  }

  @Post('attachments/reconciliation')
  async reconcileAttachments(@CurrentUser() user: AuthUser) {
    return successResponse(await this.attachmentsService.reconcileAttachments(user.id));
  }

  @Post('maintenance-records/:recordId/attachments')
  @UseInterceptors(
    FilesInterceptor('files', ATTACHMENTS_MAX_FILES, {
      limits: {
        fileSize: ATTACHMENTS_MAX_FILE_SIZE_BYTES,
      },
      fileFilter: attachmentFileFilter,
    }),
  )
  async uploadAttachments(
    @Param() params: MaintenanceRecordIdParamDto,
    @UploadedFiles() files: AttachmentUploadFile[],
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.attachmentsService.uploadAttachments(user.id, params.recordId, files ?? []),
    );
  }

  @Get('attachments/:attachmentId')
  async getAttachment(@Param() params: AttachmentIdParamDto, @CurrentUser() user: AuthUser) {
    return successResponse(
      await this.attachmentsService.getAttachmentById(user.id, params.attachmentId),
    );
  }

  @Post('attachments/:attachmentId/extract')
  async extractAttachment(@Param() params: AttachmentIdParamDto, @CurrentUser() user: AuthUser) {
    return successResponse(
      await this.attachmentsService.extractAttachment(user.id, params.attachmentId),
    );
  }

  @Post('attachments/:attachmentId/apply')
  async applyAttachmentExtraction(
    @Param() params: AttachmentIdParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.attachmentsService.applyExtraction(user.id, params.attachmentId),
    );
  }

  @Get('attachments/:attachmentId/file')
  async getAttachmentFile(
    @Param() params: AttachmentIdParamDto,
    @CurrentUser() user: AuthUser,
    @Res({ passthrough: true })
    response: { setHeader: (name: string, value: string) => void },
  ) {
    const attachment = await this.attachmentsService.getAttachmentFile(
      user.id,
      params.attachmentId,
    );

    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.originalFileName)}"`,
    );

    return new StreamableFile(attachment.fileBuffer);
  }

  @Delete('attachments/:attachmentId')
  async deleteAttachment(@Param() params: AttachmentIdParamDto, @CurrentUser() user: AuthUser) {
    return successResponse(
      await this.attachmentsService.deleteAttachment(user.id, params.attachmentId),
    );
  }
}
