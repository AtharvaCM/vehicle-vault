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
import { createReadStream } from 'node:fs';

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

  @Get('maintenance-records/:recordId/attachments')
  listAttachments(@Param() params: MaintenanceRecordIdParamDto) {
    return successResponse(this.attachmentsService.listByMaintenanceRecord(params.recordId));
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
  ) {
    return successResponse(
      await this.attachmentsService.uploadAttachments(params.recordId, files ?? []),
    );
  }

  @Get('attachments/:attachmentId')
  getAttachment(@Param() params: AttachmentIdParamDto) {
    return successResponse(this.attachmentsService.getAttachmentById(params.attachmentId));
  }

  @Get('attachments/:attachmentId/file')
  async getAttachmentFile(
    @Param() params: AttachmentIdParamDto,
    @Res({ passthrough: true })
    response: { setHeader: (name: string, value: string) => void },
  ) {
    const attachment = await this.attachmentsService.getAttachmentFile(params.attachmentId);

    response.setHeader('Content-Type', attachment.mimeType);
    response.setHeader(
      'Content-Disposition',
      `inline; filename="${encodeURIComponent(attachment.originalFileName)}"`,
    );

    return new StreamableFile(createReadStream(attachment.filePath));
  }

  @Delete('attachments/:attachmentId')
  async deleteAttachment(@Param() params: AttachmentIdParamDto) {
    return successResponse(await this.attachmentsService.deleteAttachment(params.attachmentId));
  }
}
