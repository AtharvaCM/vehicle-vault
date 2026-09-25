import {
  Controller,
  Delete,
  Body,
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
import { UuidRouteParamPipe } from '../../common/pipes/uuid-route-param.pipe';
import { successResponse } from '../../common/utils/api-response.util';
import {
  ATTACHMENTS_MAX_FILES,
  ATTACHMENTS_MAX_FILE_SIZE_BYTES,
} from './constants/attachment.constants';
import { AttachmentIdParamDto } from './dto/attachment-id-param.dto';
import { DocumentAttachmentsParamDto } from './dto/document-attachments-param.dto';
import { ExtractAttachmentsDto } from './dto/extract-attachments.dto';
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

  @Get('vehicle-loans/:loanId/attachments')
  async listLoanAttachments(
    @Param('loanId', new UuidRouteParamPipe()) loanId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(await this.attachmentsService.listByVehicleLoan(user.id, loanId));
  }

  @Post('vehicle-loans/:loanId/attachments')
  @UseInterceptors(
    FilesInterceptor('files', ATTACHMENTS_MAX_FILES, {
      limits: {
        fileSize: ATTACHMENTS_MAX_FILE_SIZE_BYTES,
      },
      fileFilter: attachmentFileFilter,
    }),
  )
  async uploadLoanAttachments(
    @Param('loanId', new UuidRouteParamPipe()) loanId: string,
    @UploadedFiles() files: AttachmentUploadFile[],
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.attachmentsService.uploadLoanAttachments(user.id, loanId, files ?? []),
    );
  }

  @Get('accessories/:accessoryId/attachments')
  async listAccessoryAttachments(
    @Param('accessoryId', new UuidRouteParamPipe()) accessoryId: string,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(await this.attachmentsService.listByAccessory(user.id, accessoryId));
  }

  /** An accessory's receipt (#336). */
  @Post('accessories/:accessoryId/attachments')
  @UseInterceptors(
    FilesInterceptor('files', ATTACHMENTS_MAX_FILES, {
      limits: {
        fileSize: ATTACHMENTS_MAX_FILE_SIZE_BYTES,
      },
      fileFilter: attachmentFileFilter,
    }),
  )
  async uploadAccessoryAttachments(
    @Param('accessoryId', new UuidRouteParamPipe()) accessoryId: string,
    @UploadedFiles() files: AttachmentUploadFile[],
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.attachmentsService.uploadAccessoryAttachments(user.id, accessoryId, files ?? []),
    );
  }

  @Get('vehicle-documents/:kind/:documentId/attachments')
  async listDocumentAttachments(
    @Param() params: DocumentAttachmentsParamDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.attachmentsService.listByDocument(user.id, params.kind, params.documentId),
    );
  }

  @Post('vehicle-documents/:kind/:documentId/attachments')
  @UseInterceptors(
    FilesInterceptor('files', ATTACHMENTS_MAX_FILES, {
      limits: {
        fileSize: ATTACHMENTS_MAX_FILE_SIZE_BYTES,
      },
      fileFilter: attachmentFileFilter,
    }),
  )
  async uploadDocumentAttachments(
    @Param() params: DocumentAttachmentsParamDto,
    @UploadedFiles() files: AttachmentUploadFile[],
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.attachmentsService.uploadDocumentAttachments(
        user.id,
        params.kind,
        params.documentId,
        files ?? [],
      ),
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

  @Post('maintenance-records/:recordId/attachments/extract')
  async extractAttachments(
    @Param() params: MaintenanceRecordIdParamDto,
    @Body() body: ExtractAttachmentsDto,
    @CurrentUser() user: AuthUser,
  ) {
    return successResponse(
      await this.attachmentsService.extractAttachments(
        user.id,
        params.recordId,
        body.attachmentIds,
      ),
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

  @Get('attachments/:attachmentId/fill')
  async getFillPlan(@Param() params: AttachmentIdParamDto, @CurrentUser() user: AuthUser) {
    return successResponse(await this.attachmentsService.getFillPlan(user.id, params.attachmentId));
  }

  @Post('attachments/:attachmentId/fill')
  async fillFromAttachment(@Param() params: AttachmentIdParamDto, @CurrentUser() user: AuthUser) {
    return successResponse(
      await this.attachmentsService.fillFromAttachment(user.id, params.attachmentId),
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
