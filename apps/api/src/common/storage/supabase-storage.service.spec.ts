import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

import { NotFoundException } from '@nestjs/common';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { SupabaseStorageService } from './supabase-storage.service';

describe('SupabaseStorageService', () => {
  let root: string;

  beforeEach(async () => {
    root = await mkdtemp(join(tmpdir(), 'vehicle-vault-storage-'));
  });

  afterEach(async () => {
    await rm(root, { recursive: true, force: true });
  });

  it('uses local storage when the backend is configured as local', async () => {
    const service = new SupabaseStorageService({
      attachmentLocalStoragePath: root,
      attachmentStorageBackend: 'local',
      supabaseServiceRoleKey: null,
      supabaseStorageBucket: 'vehicle-vault-attachments',
      supabaseUrl: null,
    } as never);

    await service.onModuleInit();
    await service.uploadObject('attachments/user-1/record-1/example.pdf', Buffer.from('hello'), 'application/pdf');

    await expect(service.objectExists('attachments/user-1/record-1/example.pdf')).resolves.toBe(true);
    await expect(service.downloadObject('attachments/user-1/record-1/example.pdf')).resolves.toEqual(
      Buffer.from('hello'),
    );
    await expect(service.deleteObject('attachments/user-1/record-1/example.pdf')).resolves.toBe(
      'deleted',
    );
    await expect(service.objectExists('attachments/user-1/record-1/example.pdf')).resolves.toBe(false);
  });

  it('returns not found when a local attachment object is missing', async () => {
    const service = new SupabaseStorageService({
      attachmentLocalStoragePath: root,
      attachmentStorageBackend: 'local',
      supabaseServiceRoleKey: null,
      supabaseStorageBucket: 'vehicle-vault-attachments',
      supabaseUrl: null,
    } as never);

    await service.onModuleInit();

    await expect(service.downloadObject('attachments/user-1/record-1/missing.pdf')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
