import { AttachmentKind, type VehicleDocument } from '@vehicle-vault/shared';
import { describe, expect, it, vi } from 'vitest';

import type { Attachment } from '@/features/attachments/types/attachment';

import { MAX_SAVED_PDF_BYTES, buildSavedPapers, papersSignature } from './build-saved-papers';
import type { SavedPapers } from './saved-papers-store';

const VEHICLE = {
  registrationNumber: 'MH12AB1234',
  electric: false,
  description: 'Swift · Petrol',
};

const insurance: VehicleDocument = {
  id: 'ins-1',
  vehicleId: 'vehicle-1',
  kind: 'insurance',
  provider: 'Bajaj Allianz',
  number: 'OG-26-1234',
  startDate: new Date('2026-01-01T00:00:00.000Z'),
  endDate: new Date('2026-12-31T00:00:00.000Z'),
  notes: 'kept in the glovebox',
  details: {},
  createdAt: new Date('2026-01-01'),
  updatedAt: new Date('2026-01-01'),
};

function attachment(name: string, mimeType: string, size = 1024): Attachment {
  return {
    id: `file-${name}`,
    insurancePolicyId: 'ins-1',
    kind: mimeType.startsWith('image/') ? AttachmentKind.Image : AttachmentKind.Document,
    fileName: `attachments/u/ins-1/${name}`,
    originalFileName: name,
    mimeType,
    size,
    url: `/api/attachments/file-${name}/file`,
    uploadedAt: '2026-09-01T00:00:00.000Z',
  };
}

const shrunk = new Blob(['small'], { type: 'image/jpeg' });

function build(
  attachments: Attachment[],
  overrides: Partial<Parameters<typeof buildSavedPapers>[0]> = {},
) {
  return buildSavedPapers({
    userId: 'user-1',
    vehicleId: 'vehicle-1',
    vehicle: VEHICLE,
    papers: [{ document: insurance, attachments }],
    previous: null,
    loadBlob: async (id) => new Blob([id], { type: 'application/octet-stream' }),
    shrinkImage: async () => shrunk,
    now: new Date('2026-09-25T04:44:00.000Z'),
    ...overrides,
  });
}

describe('buildSavedPapers', () => {
  it('keeps the words and dates, for this user, at this time', async () => {
    const saved = await build([]);

    expect(saved).toMatchObject({
      vehicleId: 'vehicle-1',
      userId: 'user-1',
      savedAt: '2026-09-25T04:44:00.000Z',
      vehicle: VEHICLE,
      papers: [
        {
          id: 'ins-1',
          kind: 'insurance',
          number: 'OG-26-1234',
          provider: 'Bajaj Allianz',
          startDate: '2026-01-01T00:00:00.000Z',
          endDate: '2026-12-31T00:00:00.000Z',
          files: [],
        },
      ],
    });
    // Only what gets shown: no notes or details on the device.
    expect(JSON.stringify(saved)).not.toContain('glovebox');
  });

  it('keeps a shrunk JPEG of each photo', async () => {
    const shrinkImage = vi.fn(async () => shrunk);
    const saved = await build([attachment('policy.png', 'image/png')], { shrinkImage });

    expect(shrinkImage).toHaveBeenCalledTimes(1);
    expect(saved.papers[0]!.files).toEqual([
      { id: 'file-policy.png', name: 'policy.png', mimeType: 'image/jpeg', blob: shrunk },
    ]);
  });

  it('keeps a small PDF whole, and only the name of a large one', async () => {
    const loadBlob = vi.fn(async (id: string) => new Blob([id]));
    const saved = await build(
      [
        attachment('policy.pdf', 'application/pdf'),
        attachment('scan.pdf', 'application/pdf', MAX_SAVED_PDF_BYTES + 1),
      ],
      { loadBlob },
    );

    const [small, large] = saved.papers[0]!.files;
    expect(small).toMatchObject({ name: 'policy.pdf', mimeType: 'application/pdf' });
    expect(small!.blob).toBeInstanceOf(Blob);
    expect(large).toEqual({
      id: 'file-scan.pdf',
      name: 'scan.pdf',
      mimeType: 'application/pdf',
      blob: null,
    });
    // The large one is never downloaded.
    expect(loadBlob).toHaveBeenCalledTimes(1);
  });

  it("keeps the photo it had when the file can't be fetched now", async () => {
    const kept = new Blob(['kept'], { type: 'image/jpeg' });
    const previous = {
      papers: [
        {
          files: [
            { id: 'file-policy.jpg', name: 'policy.jpg', mimeType: 'image/jpeg', blob: kept },
          ],
        },
      ],
    } as SavedPapers;

    const saved = await build(
      [attachment('policy.jpg', 'image/jpeg'), attachment('other.jpg', 'image/jpeg')],
      {
        previous,
        loadBlob: async () => {
          throw new TypeError('Failed to fetch');
        },
      },
    );

    expect(saved.papers[0]!.files.map((file) => file.blob)).toEqual([kept, null]);
  });

  it("keeps a small photo as it is when it can't be shrunk", async () => {
    const saved = await build([attachment('policy.heic', 'image/heic')], {
      shrinkImage: async () => {
        throw new Error('cannot decode');
      },
    });

    expect(saved.papers[0]!.files[0]).toMatchObject({ mimeType: 'image/heic' });
    expect(saved.papers[0]!.files[0]!.blob).toBeInstanceOf(Blob);
  });
});

describe('papersSignature', () => {
  it('changes when what is shown changes, and not otherwise', () => {
    const papers = [{ document: insurance, attachments: [attachment('a.jpg', 'image/jpeg')] }];
    const same = papersSignature(VEHICLE, papers);

    expect(papersSignature(VEHICLE, papers)).toBe(same);
    expect(
      papersSignature(VEHICLE, [{ ...papers[0]!, document: { ...insurance, number: 'NEW' } }]),
    ).not.toBe(same);
    expect(papersSignature(VEHICLE, [{ document: insurance, attachments: [] }])).not.toBe(same);
    expect(papersSignature({ ...VEHICLE, registrationNumber: 'MH12ZZ0001' }, papers)).not.toBe(
      same,
    );
  });
});
