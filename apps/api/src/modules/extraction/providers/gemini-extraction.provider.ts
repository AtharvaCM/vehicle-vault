import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI } from '@google/generative-ai';

import { AppConfigService } from '../../../config/app-config.service';
import type { ExtractionFile, ExtractionProvider } from '../types';

@Injectable()
export class GeminiExtractionProvider implements ExtractionProvider {
  readonly name = 'gemini' as const;

  private readonly genAI: GoogleGenerativeAI | null = null;

  constructor(private readonly config: AppConfigService) {
    const apiKey = this.config.geminiApiKey;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
    }
  }

  get isAvailable(): boolean {
    return this.genAI !== null;
  }

  async generate(args: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    responseSchema: any;
    prompt: string;
    files: ExtractionFile[];
  }): Promise<{ raw: unknown }> {
    if (!this.genAI) {
      throw new InternalServerErrorException(
        'DocumentExtraction provider is not configured (missing GEMINI_API_KEY).',
      );
    }

    if (args.files.length === 0) {
      throw new InternalServerErrorException(
        'DocumentExtraction requires at least one file.',
      );
    }

    const model = this.genAI.getGenerativeModel({
      model: this.config.geminiModel,
      generationConfig: {
        responseMimeType: 'application/json',
        responseSchema: args.responseSchema,
      },
    });

    const fileParts = args.files.flatMap((file, index) => [
      {
        text:
          args.files.length > 1
            ? `Document page ${index + 1}${file.name ? `: ${file.name}` : ''}`
            : '',
      },
      {
        inlineData: {
          data: file.buffer.toString('base64'),
          mimeType: file.mimeType,
        },
      },
    ]);

    try {
      const result = await model.generateContent([args.prompt, ...fileParts]);
      const text = result.response.text();
      return { raw: JSON.parse(text) };
    } catch (error) {
      console.error('Gemini extraction error:', error);
      throw new InternalServerErrorException(
        'Failed to extract document with AI provider.',
      );
    }
  }
}
