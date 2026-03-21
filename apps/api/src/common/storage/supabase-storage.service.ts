import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private readonly client: SupabaseClient;

  constructor(private readonly appConfigService: AppConfigService) {
    const supabaseUrl = this.appConfigService.supabaseUrl;
    const supabaseServiceRoleKey = this.appConfigService.supabaseServiceRoleKey;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        'Supabase storage is not configured. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });
  }

  async onModuleInit() {
    const { error } = await this.client.storage.createBucket(this.bucketName, {
      public: false,
    });

    if (error && !error.message.toLowerCase().includes('already')) {
      throw new InternalServerErrorException(
        `Unable to initialize storage bucket ${this.bucketName}.`,
      );
    }
  }

  get bucketName() {
    return this.appConfigService.supabaseStorageBucket;
  }

  async uploadObject(path: string, file: Buffer, contentType: string) {
    const { error } = await this.client.storage.from(this.bucketName).upload(path, file, {
      contentType,
      upsert: false,
    });

    if (error) {
      throw new InternalServerErrorException('Unable to upload attachment to cloud storage.');
    }
  }

  async downloadObject(path: string) {
    const { data, error } = await this.client.storage.from(this.bucketName).download(path);

    if (error) {
      if (error.message.toLowerCase().includes('not found')) {
        throw new NotFoundException(`Attachment file ${path} was not found in cloud storage.`);
      }

      throw new InternalServerErrorException('Unable to download attachment from cloud storage.');
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async deleteObject(path: string) {
    const { error } = await this.client.storage.from(this.bucketName).remove([path]);

    if (error) {
      throw new InternalServerErrorException('Unable to remove attachment from cloud storage.');
    }
  }
}
