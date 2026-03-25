import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { GoogleGenerativeAI, SchemaType } from '@google/generative-ai';
import { AppConfigService } from '../../config/app-config.service';

export interface ScannedFuelLog {
  date?: string;
  quantity?: number;
  price?: number;
  totalCost?: number;
  location?: string;
}

@Injectable()
export class FuelLogsOCRService {
  private genAI: GoogleGenerativeAI;
  private model: any;

  constructor(private readonly config: AppConfigService) {
    const apiKey = this.config.geminiApiKey;
    if (apiKey) {
      this.genAI = new GoogleGenerativeAI(apiKey);
      
      // Use constrained output schema for reliable JSON
      const schema = {
        description: "Fuel receipt data extraction",
        type: SchemaType.OBJECT,
        properties: {
          date: {
            type: SchemaType.STRING,
            description: "ISO 8601 date string of the transaction",
          },
          quantity: {
            type: SchemaType.NUMBER,
            description: "Number of litres filled",
          },
          price: {
            type: SchemaType.NUMBER,
            description: "Price per litre",
          },
          totalCost: {
            type: SchemaType.NUMBER,
            description: "Total amount paid",
          },
          location: {
            type: SchemaType.STRING,
            description: "Name of the gas station",
          },
        },
        required: ["totalCost"],
      };

      this.model = this.genAI.getGenerativeModel({
        model: "gemini-1.5-flash",
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: schema as any,
        },
      });
    }
  }

  async scanReceipt(file: Buffer, mimeType: string): Promise<ScannedFuelLog> {
    if (!this.model) {
      throw new InternalServerErrorException('OCR service is not configured (missing API key)');
    }

    try {
      const prompt = "Extract fuel receipt data from this image. If a field is not found, omit it. Return valid JSON.";
      
      const result = await this.model.generateContent([
        prompt,
        {
          inlineData: {
            data: file.toString('base64'),
            mimeType,
          },
        },
      ]);

      const response = await result.response;
      const text = response.text();
      return JSON.parse(text) as ScannedFuelLog;
    } catch (error) {
      console.error('OCR Error:', error);
      throw new InternalServerErrorException('Failed to process receipt with AI service.');
    }
  }
}
