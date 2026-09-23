import { IsUuidRouteParam } from '../../../common/validators/is-uuid-route-param.validator';

export class CatalogImportRunIdParamDto {
  @IsUuidRouteParam()
  runId!: string;
}
