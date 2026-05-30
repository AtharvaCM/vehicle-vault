import 'multer';
import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  VehicleDocumentKindSchema,
  type CreateVehicleDocumentInput,
  type InsurancePolicyExtractionDraft,
  type UpdateVehicleDocumentInput,
  type VehicleDocumentKind,
} from '@vehicle-vault/shared';

import { JwtAuthGuard } from '../../common/auth/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/auth/decorators/current-user.decorator';
import { ExtractionService } from '../extraction/extraction.service';
import { VehiclesService } from '../vehicles/vehicles.service';
import { VehicleDocumentsService } from './vehicle-documents.service';

const KIND_VALUES = VehicleDocumentKindSchema.options;

const SCAN_MAX_BYTES = 10 * 1024 * 1024;
const SCAN_ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
]);

const DOCUMENT_KIND_TO_EXTRACTION_KIND = {
  insurance: 'insurance_policy',
} as const satisfies Partial<Record<VehicleDocumentKind, string>>;

@Controller('vehicles/:vehicleId/documents')
@UseGuards(JwtAuthGuard)
export class VehicleDocumentsController {
  constructor(
    private readonly vehicleDocumentsService: VehicleDocumentsService,
    private readonly extractionService: ExtractionService,
    private readonly vehiclesService: VehiclesService,
  ) {}

  @Get()
  async list(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Query('kind') kind?: string,
  ) {
    const parsedKind = parseOptionalKind(kind);
    return this.vehicleDocumentsService.listForVehicle(userId, vehicleId, parsedKind);
  }

  @Get('active')
  async listActive(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Query('date') date?: string,
    @Query('kind') kind?: string,
  ) {
    const at = date ? new Date(date) : new Date();
    if (Number.isNaN(at.getTime())) {
      throw new BadRequestException('Invalid "date" query parameter.');
    }
    const parsedKind = parseOptionalKind(kind);
    return this.vehicleDocumentsService.activeCoverageAt(userId, vehicleId, at, parsedKind);
  }

  @Get('scan/status')
  scanStatus(@Query('kind') kind?: string) {
    const parsedKind = parseRequiredKind(kind ?? '');
    const extractionKind = requireExtractionKind(parsedKind);
    return {
      available:
        this.extractionService.isAvailable && this.extractionService.hasKind(extractionKind),
    };
  }

  @Post('scan')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: SCAN_MAX_BYTES },
    }),
  )
  async scan(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Query('kind') kind: string,
    @UploadedFile() file: Express.Multer.File | undefined,
  ) {
    if (!file) {
      throw new BadRequestException('A "file" multipart field is required.');
    }
    if (!SCAN_ALLOWED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException(
        `Unsupported file type "${file.mimetype}". Expected one of: ${Array.from(
          SCAN_ALLOWED_MIME_TYPES,
        ).join(', ')}.`,
      );
    }

    const parsedKind = parseRequiredKind(kind);
    const extractionKind = requireExtractionKind(parsedKind);

    const vehicle = await this.vehiclesService.ensureVehicleExists(userId, vehicleId);

    return this.extractionService.extract<InsurancePolicyExtractionDraft>(
      extractionKind,
      [{ buffer: file.buffer, mimeType: file.mimetype, name: file.originalname }],
      {
        registrationNumber: vehicle.registrationNumber,
        make: vehicle.make,
        model: vehicle.model,
        year: vehicle.year,
      },
    );
  }

  @Post()
  async create(
    @CurrentUser('id') userId: string,
    @Param('vehicleId') vehicleId: string,
    @Body() payload: CreateVehicleDocumentInput,
  ) {
    return this.vehicleDocumentsService.create(userId, vehicleId, payload);
  }

  @Patch(':id')
  async update(
    @CurrentUser('id') userId: string,
    @Param('id') id: string,
    @Body() payload: UpdateVehicleDocumentInput,
  ) {
    return this.vehicleDocumentsService.update(userId, id, payload);
  }

  @Delete(':kind/:id')
  async remove(
    @CurrentUser('id') userId: string,
    @Param('kind') kindParam: string,
    @Param('id') id: string,
  ) {
    const kind = parseRequiredKind(kindParam);
    await this.vehicleDocumentsService.remove(userId, kind, id);
    return { removed: true };
  }
}

function parseRequiredKind(value: string): VehicleDocumentKind {
  const parsed = VehicleDocumentKindSchema.safeParse(value);
  if (!parsed.success) {
    throw new BadRequestException(
      `Invalid "kind" parameter. Expected one of: ${KIND_VALUES.join(', ')}`,
    );
  }
  return parsed.data;
}

function parseOptionalKind(value: string | undefined): VehicleDocumentKind | undefined {
  if (!value) return undefined;
  return parseRequiredKind(value);
}

function requireExtractionKind(kind: VehicleDocumentKind) {
  const extractionKind =
    DOCUMENT_KIND_TO_EXTRACTION_KIND[kind as keyof typeof DOCUMENT_KIND_TO_EXTRACTION_KIND];
  if (!extractionKind) {
    throw new BadRequestException(
      `Document scan is not supported for kind "${kind}" yet.`,
    );
  }
  return extractionKind;
}
