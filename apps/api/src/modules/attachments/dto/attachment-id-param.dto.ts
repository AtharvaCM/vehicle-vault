import { IsUuidRouteParam } from '../../../common/validators/is-uuid-route-param.validator';

export class AttachmentIdParamDto {
  @IsUuidRouteParam()
  attachmentId!: string;
}
