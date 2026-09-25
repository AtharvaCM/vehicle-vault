import type { VehicleDocument } from '@vehicle-vault/shared';

import type { Attachment } from '@/features/attachments/types/attachment';

import type { SavedPaper, SavedPaperFile, SavedPapers } from './saved-papers-store';

/** A photo is kept at most this many pixels along its longer edge: readable, not heavy. */
const MAX_IMAGE_EDGE = 1600;
const JPEG_QUALITY = 0.8;
/** A photo that cannot be shrunk is kept as it is only up to this size. */
const MAX_UNSHRUNK_IMAGE_BYTES = 1_500_000;
/** A PDF cannot be shrunk; one up to this size is kept whole, a larger one waits for signal. */
export const MAX_SAVED_PDF_BYTES = 2_000_000;

export type PaperWithFiles = {
  document: VehicleDocument;
  attachments: readonly Attachment[];
};

export type SavedVehicle = SavedPapers['vehicle'];

const isoOrNull = (value: Date | string | null) =>
  value === null ? null : new Date(value).toISOString();

/** What a copy is built from, so an unchanged one only needs its time moved on. */
export function papersSignature(vehicle: SavedVehicle, papers: readonly PaperWithFiles[]) {
  return JSON.stringify([
    vehicle,
    papers.map(({ document, attachments }) => [
      document.id,
      document.number,
      document.provider,
      isoOrNull(document.startDate),
      isoOrNull(document.endDate),
      attachments.map((attachment) => attachment.id),
    ]),
  ]);
}

async function decode(blob: Blob): Promise<{
  source: CanvasImageSource;
  width: number;
  height: number;
  release: () => void;
}> {
  if (typeof createImageBitmap === 'function') {
    const bitmap = await createImageBitmap(blob);
    return {
      source: bitmap,
      width: bitmap.width,
      height: bitmap.height,
      release: () => bitmap.close(),
    };
  }
  const url = URL.createObjectURL(blob);
  const image = new Image();
  image.src = url;
  try {
    await image.decode();
  } catch (error) {
    URL.revokeObjectURL(url);
    throw error;
  }
  return {
    source: image,
    width: image.naturalWidth,
    height: image.naturalHeight,
    release: () => URL.revokeObjectURL(url),
  };
}

/** The photo redrawn as a JPEG no larger than MAX_IMAGE_EDGE. Throws where the browser can't. */
export async function downscaleImage(blob: Blob): Promise<Blob> {
  const image = await decode(blob);
  try {
    const scale = Math.min(1, MAX_IMAGE_EDGE / Math.max(image.width, image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.max(1, Math.round(image.width * scale));
    canvas.height = Math.max(1, Math.round(image.height * scale));
    const context = canvas.getContext('2d');
    if (!context) throw new Error('No 2D canvas');
    // A transparent PNG would turn black as a JPEG.
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(image.source, 0, 0, canvas.width, canvas.height);
    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (result) => (result ? resolve(result) : reject(new Error('Could not encode the photo'))),
        'image/jpeg',
        JPEG_QUALITY,
      );
    });
  } finally {
    image.release();
  }
}

type BuildOptions = {
  userId: string;
  vehicleId: string;
  vehicle: SavedVehicle;
  papers: readonly PaperWithFiles[];
  /** The file itself, fetched through the API client. */
  loadBlob: (attachmentId: string) => Promise<Blob>;
  /** The copy already on the device: a file that can't be fetched now keeps what it had. */
  previous: SavedPapers | null;
  shrinkImage?: (blob: Blob) => Promise<Blob>;
  now?: Date;
};

async function saveFile(
  attachment: Attachment,
  { loadBlob, previous, shrinkImage = downscaleImage }: BuildOptions,
): Promise<SavedPaperFile> {
  const kept = previous?.papers
    .flatMap((paper) => paper.files)
    .find((file) => file.id === attachment.id && file.blob);
  const isImage = attachment.mimeType.startsWith('image/');
  const unsaved = { id: attachment.id, name: attachment.originalFileName, blob: null };

  if (!isImage && attachment.size > MAX_SAVED_PDF_BYTES) {
    return { ...unsaved, mimeType: attachment.mimeType };
  }

  let original: Blob;
  try {
    original = await loadBlob(attachment.id);
  } catch {
    return kept ?? { ...unsaved, mimeType: attachment.mimeType };
  }

  if (!isImage) {
    return { ...unsaved, mimeType: attachment.mimeType, blob: original };
  }
  try {
    return { ...unsaved, mimeType: 'image/jpeg', blob: await shrinkImage(original) };
  } catch {
    return original.size <= MAX_UNSHRUNK_IMAGE_BYTES
      ? { ...unsaved, mimeType: attachment.mimeType, blob: original }
      : (kept ?? { ...unsaved, mimeType: attachment.mimeType });
  }
}

/**
 * The copy of a vehicle's papers this device keeps: the words and dates as
 * they are, photos shrunk, small PDFs whole. One file that can't be fetched
 * does not stop the rest being saved.
 */
export async function buildSavedPapers(options: BuildOptions): Promise<SavedPapers> {
  const { userId, vehicleId, vehicle, papers, now = new Date() } = options;
  const savedPapers: SavedPaper[] = [];

  for (const { document, attachments } of papers) {
    const files: SavedPaperFile[] = [];
    // One at a time: a phone on a weak signal gets each file sooner than all at once.
    for (const attachment of attachments) {
      files.push(await saveFile(attachment, options));
    }
    savedPapers.push({
      id: document.id,
      kind: document.kind,
      number: document.number,
      provider: document.provider,
      startDate: isoOrNull(document.startDate),
      endDate: isoOrNull(document.endDate),
      files,
    });
  }

  return {
    vehicleId,
    userId,
    savedAt: now.toISOString(),
    signature: papersSignature(vehicle, papers),
    vehicle,
    papers: savedPapers,
  };
}
