import { Global, Module } from '@nestjs/common';

import { AppConfigModule } from '../../config/app-config.module';
import { ExtractionRegistry } from './extraction-registry.service';
import { ExtractionService } from './extraction.service';
import { GeminiExtractionProvider } from './providers/gemini-extraction.provider';
import { EXTRACTION_PROVIDER } from './types';

@Global()
@Module({
  imports: [AppConfigModule],
  providers: [
    GeminiExtractionProvider,
    {
      provide: EXTRACTION_PROVIDER,
      useExisting: GeminiExtractionProvider,
    },
    ExtractionRegistry,
    ExtractionService,
  ],
  exports: [ExtractionService, ExtractionRegistry],
})
export class ExtractionModule {}
