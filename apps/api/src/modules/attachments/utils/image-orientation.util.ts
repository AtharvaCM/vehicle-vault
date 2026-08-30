import jpeg from 'jpeg-js';

import type { ExtractionFile } from '../../extraction/types';

/**
 * Phone cameras record the sensor orientation as an EXIF tag and leave the pixels
 * themselves unrotated. Browsers and photo viewers honour that tag, so an invoice a
 * user photographed looks upright everywhere they check it — but the extraction
 * provider reads raw pixels, and sideways text costs it accuracy.
 *
 * This normalises the pixels before extraction only. Stored attachments keep their
 * original bytes, so what the user downloads is still exactly what they uploaded.
 */

const EXIF_ORIENTATION_TAG = 0x0112;

// Decoding is pure JS, so a hostile or simply enormous image would tie up the event
// loop. Uploads are already capped at 5 MB; this is a second, cheaper guard on the
// decoded surface rather than the encoded size.
const MAX_DECODED_PIXELS = 40_000_000;

const JPEG_REENCODE_QUALITY = 92;

type RotationQuarterTurns = 0 | 1 | 2 | 3;

/**
 * Returns the file with upright pixels when the EXIF orientation says it is rotated.
 *
 * Orientation is a hint, not a contract: a malformed tag, an unreadable JPEG, or an
 * oversized image all fall back to the original file. Extraction losing a little
 * accuracy beats extraction failing outright.
 */
export function normalizeExtractionImageOrientation(file: ExtractionFile): ExtractionFile {
  if (file.mimeType !== 'image/jpeg') {
    return file;
  }

  const quarterTurns = readJpegOrientationQuarterTurns(file.buffer);

  if (!quarterTurns) {
    return file;
  }

  try {
    const decoded = jpeg.decode(file.buffer, { useTArray: true });

    if (decoded.width * decoded.height > MAX_DECODED_PIXELS) {
      return file;
    }

    const rotated = rotateRgba(decoded, quarterTurns);
    const encoded = jpeg.encode(rotated, JPEG_REENCODE_QUALITY);

    return {
      ...file,
      buffer: Buffer.from(encoded.data),
    };
  } catch {
    return file;
  }
}

/**
 * Reads the IFD0 orientation tag and maps it to clockwise quarter turns.
 *
 * The four mirrored orientations (2, 4, 5, 7) are deliberately not handled: they need
 * a flip as well as a rotation, they effectively do not occur on phone cameras, and a
 * wrong guess would leave the text mirrored — worse for extraction than leaving it be.
 */
function readJpegOrientationQuarterTurns(buffer: Buffer): RotationQuarterTurns | null {
  switch (readJpegExifOrientation(buffer)) {
    case 3:
      return 2;
    case 6:
      return 1;
    case 8:
      return 3;
    default:
      return null;
  }
}

export function readJpegExifOrientation(buffer: Buffer): number | null {
  // SOI
  if (buffer.length < 4 || buffer[0] !== 0xff || buffer[1] !== 0xd8) {
    return null;
  }

  let offset = 2;

  while (offset + 4 <= buffer.length) {
    if (buffer[offset] !== 0xff) {
      return null;
    }

    const marker = buffer[offset + 1]!;

    // Start of scan — EXIF only ever appears in the header, so stop before the
    // entropy-coded image data, where marker bytes are no longer segment markers.
    if (marker === 0xda) {
      return null;
    }

    const segmentLength = buffer.readUInt16BE(offset + 2);

    if (segmentLength < 2 || offset + 2 + segmentLength > buffer.length) {
      return null;
    }

    if (marker === 0xe1) {
      const segment = buffer.subarray(offset + 4, offset + 2 + segmentLength);
      const orientation = readExifSegmentOrientation(segment);

      if (orientation !== null) {
        return orientation;
      }
    }

    offset += 2 + segmentLength;
  }

  return null;
}

function readExifSegmentOrientation(segment: Buffer): number | null {
  if (segment.length < 14 || segment.subarray(0, 6).toString('ascii') !== 'Exif\0\0') {
    return null;
  }

  const tiff = segment.subarray(6);
  const byteOrder = tiff.subarray(0, 2).toString('ascii');

  if (byteOrder !== 'II' && byteOrder !== 'MM') {
    return null;
  }

  const littleEndian = byteOrder === 'II';
  const readUInt16 = (at: number) =>
    littleEndian ? tiff.readUInt16LE(at) : tiff.readUInt16BE(at);
  const readUInt32 = (at: number) =>
    littleEndian ? tiff.readUInt32LE(at) : tiff.readUInt32BE(at);

  if (tiff.length < 8 || readUInt16(2) !== 42) {
    return null;
  }

  const ifdOffset = readUInt32(4);

  if (ifdOffset + 2 > tiff.length) {
    return null;
  }

  const entryCount = readUInt16(ifdOffset);

  for (let index = 0; index < entryCount; index += 1) {
    const entryOffset = ifdOffset + 2 + index * 12;

    if (entryOffset + 12 > tiff.length) {
      return null;
    }

    if (readUInt16(entryOffset) === EXIF_ORIENTATION_TAG) {
      // Value fits in the entry's own 4-byte value field, so it is read in place.
      return readUInt16(entryOffset + 8);
    }
  }

  return null;
}

type RgbaImage = {
  data: Uint8Array | Buffer;
  width: number;
  height: number;
};

function rotateRgba(image: RgbaImage, quarterTurns: RotationQuarterTurns) {
  const { width, height } = image;
  const source = image.data;
  const rotatedDimensions = quarterTurns % 2 === 1;
  const targetWidth = rotatedDimensions ? height : width;
  const targetHeight = rotatedDimensions ? width : height;
  const target = Buffer.allocUnsafe(width * height * 4);

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const sourceIndex = (y * width + x) * 4;
      let targetX: number;
      let targetY: number;

      if (quarterTurns === 1) {
        targetX = height - 1 - y;
        targetY = x;
      } else if (quarterTurns === 2) {
        targetX = width - 1 - x;
        targetY = height - 1 - y;
      } else {
        targetX = y;
        targetY = width - 1 - x;
      }

      const targetIndex = (targetY * targetWidth + targetX) * 4;

      target[targetIndex] = source[sourceIndex]!;
      target[targetIndex + 1] = source[sourceIndex + 1]!;
      target[targetIndex + 2] = source[sourceIndex + 2]!;
      target[targetIndex + 3] = source[sourceIndex + 3]!;
    }
  }

  return { data: target, width: targetWidth, height: targetHeight };
}
