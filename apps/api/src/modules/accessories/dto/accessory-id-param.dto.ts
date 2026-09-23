import { IsUuidRouteParam } from '../../../common/validators/is-uuid-route-param.validator';

export class AccessoryIdParamDto {
  @IsUuidRouteParam()
  accessoryId!: string;
}
