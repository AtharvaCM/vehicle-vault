import { PartialType } from '@nestjs/swagger';

import { CreateTyreDto } from './create-tyre.dto';

export class UpdateTyreDto extends PartialType(CreateTyreDto) {}
