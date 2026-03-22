import { IsUUID } from 'class-validator';

export class CatalogOfferingIdParamDto {
  @IsUUID()
  offeringId!: string;
}
