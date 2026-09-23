import { IsUuidRouteParam } from '../../../common/validators/is-uuid-route-param.validator';

export class ReminderIdParamDto {
  @IsUuidRouteParam()
  reminderId!: string;
}
