import { IsUUID } from 'class-validator';

export class CatalogImportRunIdParamDto {
  @IsUUID()
  runId!: string;
}
