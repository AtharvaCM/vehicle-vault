import { IsUuidRouteParam } from '../../../common/validators/is-uuid-route-param.validator';

export class MaintenanceRecordIdParamDto {
  @IsUuidRouteParam()
  recordId!: string;
}
