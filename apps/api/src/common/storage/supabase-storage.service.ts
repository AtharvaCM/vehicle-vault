import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { basename as posixBasename, dirname as posixDirname } from 'node:path/posix';

import { AppConfigService } from '../../config/app-config.service';

@Injectable()
export class SupabaseStorageService implements OnModuleInit {
  private readonly client: SupabaseClient | null;
  private readonly storageBackend: 'local' | 'supabase';

  constructor(private readonly appConfigService: AppConfigService) {
    this.storageBackend = this.appConfigService.attachmentStorageBackend;
    const supabaseUrl = this.appConfigService.supabaseUrl;
    const supabaseServiceRoleKey = this.appConfigService.supabaseServiceRoleKey;

    if (this.storageBackend === 'local') {
      this.client = null;
      return;
    }

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
    if (this.storageBackend === 'local') {
      await mkdir(this.localStorageRoot, { recursive: true });
      return;
    }

    const { error } = await this.client!.storage.createBucket(this.bucketName, {
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

  get localStorageRoot() {
    return this.appConfigService.attachmentLocalStoragePath;
  }

  async uploadObject(path: string, file: Buffer, contentType: string) {
    if (this.storageBackend === 'local') {
      const targetPath = this.resolveLocalPath(path);
      await mkdir(dirname(targetPath), { recursive: true });
      await writeFile(targetPath, file);
      return;
    }

    const { error } = await this.client!.storage.from(this.bucketName).upload(path, file, {
      contentType,
      upsert: false,
    });

    if (error) {
      throw new InternalServerErrorException('Unable to upload attachment to cloud storage.');
    }
  }

  async objectExists(path: string) {
    if (this.storageBackend === 'local') {
      return this.localObjectExists(path);
    }

    const objectName = posixBasename(path);
    const directory = posixDirname(path);
    const { data, error } = await this.client!.storage.from(this.bucketName).list(
      directory === '.' ? '' : directory,
      {
        limit: 100,
        search: objectName,
      },
    );

    if (error) {
      throw new InternalServerErrorException('Unable to inspect attachment in cloud storage.');
    }

    return (data ?? []).some((object) => object.name === objectName);
  }

  async downloadObject(path: string) {
    if (this.storageBackend === 'local') {
      try {
        return await readFile(this.resolveLocalPath(path));
      } catch {
        throw new NotFoundException(`Attachment file ${path} was not found in cloud storage.`);
      }
    }

    const { data, error } = await this.client!.storage.from(this.bucketName).download(path);

    if (error) {
      if (error.message.toLowerCase().includes('not found')) {
        throw new NotFoundException(`Attachment file ${path} was not found in cloud storage.`);
      }

      throw new InternalServerErrorException('Unable to download attachment from cloud storage.');
    }

    return Buffer.from(await data.arrayBuffer());
  }

  async deleteObject(path: string) {
    const exists = await this.objectExists(path);

    if (!exists) {
      return 'missing' as const;
    }

    if (this.storageBackend === 'local') {
      await rm(this.resolveLocalPath(path), { force: true });
      return 'deleted' as const;
    }

    const { error } = await this.client!.storage.from(this.bucketName).remove([path]);

    if (error) {
      throw new InternalServerErrorException('Unable to remove attachment from cloud storage.');
    }

    return 'deleted' as const;
  }

  private async localObjectExists(path: string) {
    try {
      await access(this.resolveLocalPath(path));
      return true;
    } catch {
      return false;
    }
  }

  private resolveLocalPath(storagePath: string) {
    return join(this.localStorageRoot, ...storagePath.split('/').filter(Boolean));
  }
}
