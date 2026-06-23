import { Controller, Get, Query } from '@nestjs/common';

import { successResponse } from '../../common/utils/api-response.util';
import { MaintenancePartsService } from './maintenance-parts.service';

@Controller('maintenance/parts')
export class MaintenancePartsController {
  constructor(private readonly parts: MaintenancePartsService) {}

  /**
   * Autocomplete + category suggestion used by the line-item editor and the
   * extraction confirm form. Returns the single best match plus a short prefix
   * list so the UI can render both "use this category" and "did you mean…".
   */
  @Get('suggest')
  async suggest(
    @Query('name') name?: string,
    @Query('partNumber') partNumber?: string,
  ) {
    const trimmedName = name?.trim() ?? '';
    if (!trimmedName) {
      return successResponse({ best: null, matches: [] });
    }
    const [best, matches] = await Promise.all([
      this.parts.suggestCategory(trimmedName, partNumber?.trim() || null),
      this.parts.searchByPrefix(trimmedName, 10),
    ]);
    return successResponse({ best, matches });
  }
}
