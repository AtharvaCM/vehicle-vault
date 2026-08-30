import jpeg from 'jpeg-js';
import { describe, expect, it } from 'vitest';

import {
  normalizeExtractionImageOrientation,
  readJpegExifOrientation,
} from './image-orientation.util';

function encodeJpeg(width: number, height: number) {
  const data = Buffer.alloc(width * height * 4);

  for (let index = 0; index < width * height; index += 1) {
    // A gradient rather than a flat fill, so a rotation is actually observable.
    data[index * 4] = (index * 7) % 256;
    data[index * 4 + 1] = (index * 13) % 256;
    data[index * 4 + 2] = (index * 29) % 256;
    data[index * 4 + 3] = 255;
  }

  return Buffer.from(jpeg.encode({ data, width, height }, 90).data);
}

function withExifOrientation(jpegBuffer: Buffer, orientation: number) {
  const tiff = Buffer.alloc(26);
  tiff.write('II', 0, 'ascii');
  tiff.writeUInt16LE(42, 2);
  tiff.writeUInt32LE(8, 4);
  tiff.writeUInt16LE(1, 8); // one IFD0 entry
  tiff.writeUInt16LE(0x0112, 10); // orientation tag
  tiff.writeUInt16LE(3, 12); // SHORT
  tiff.writeUInt32LE(1, 14); // count
  tiff.writeUInt16LE(orientation, 18);
  tiff.writeUInt32LE(0, 22); // no next IFD

  const payload = Buffer.concat([Buffer.from('Exif\0\0', 'ascii'), tiff]);
  const header = Buffer.alloc(4);
  header.writeUInt16BE(0xffe1, 0);
  header.writeUInt16BE(payload.length + 2, 2);

  return Buffer.concat([
    jpegBuffer.subarray(0, 2),
    header,
    payload,
    jpegBuffer.subarray(2),
  ]);
}

describe('readJpegExifOrientation', () => {
  it('reads the orientation tag out of the EXIF segment', () => {
    expect(readJpegExifOrientation(withExifOrientation(encodeJpeg(8, 4), 6))).toBe(6);
  });

  it('returns null when there is no EXIF segment', () => {
    expect(readJpegExifOrientation(encodeJpeg(8, 4))).toBeNull();
  });

  it('returns null for a buffer that is not a JPEG', () => {
    expect(readJpegExifOrientation(Buffer.from('not a jpeg at all'))).toBeNull();
  });
});

describe('normalizeExtractionImageOrientation', () => {
  it('rotates a quarter turn clockwise for orientation 6', () => {
    const file = {
      buffer: withExifOrientation(encodeJpeg(8, 4), 6),
      mimeType: 'image/jpeg',
      name: 'invoice.jpg',
    };

    const normalized = normalizeExtractionImageOrientation(file);
    const decoded = jpeg.decode(normalized.buffer, { useTArray: true });

    expect(normalized.buffer).not.toBe(file.buffer);
    expect(decoded.width).toBe(4);
    expect(decoded.height).toBe(8);
    expect(normalized.name).toBe('invoice.jpg');
  });

  it('keeps the dimensions for the 180 degree orientation', () => {
    const normalized = normalizeExtractionImageOrientation({
      buffer: withExifOrientation(encodeJpeg(8, 4), 3),
      mimeType: 'image/jpeg',
    });
    const decoded = jpeg.decode(normalized.buffer, { useTArray: true });

    expect(decoded.width).toBe(8);
    expect(decoded.height).toBe(4);
  });

  it('leaves an upright image untouched', () => {
    const file = {
      buffer: withExifOrientation(encodeJpeg(8, 4), 1),
      mimeType: 'image/jpeg',
    };

    expect(normalizeExtractionImageOrientation(file)).toBe(file);
  });

  it('leaves mirrored orientations untouched rather than guessing at the flip', () => {
    const file = {
      buffer: withExifOrientation(encodeJpeg(8, 4), 5),
      mimeType: 'image/jpeg',
    };

    expect(normalizeExtractionImageOrientation(file)).toBe(file);
  });

  it('leaves non-JPEG files alone', () => {
    const file = { buffer: Buffer.from('%PDF-1.7'), mimeType: 'application/pdf' };

    expect(normalizeExtractionImageOrientation(file)).toBe(file);
  });

  it('falls back to the original file when the JPEG cannot be decoded', () => {
    // A well-formed EXIF header in front of image data that is not decodable: the
    // orientation says to rotate, the decode fails, and extraction still gets a file.
    const file = {
      buffer: withExifOrientation(
        Buffer.concat([Buffer.from([0xff, 0xd8]), Buffer.from('truncated')]),
        6,
      ),
      mimeType: 'image/jpeg',
    };

    expect(normalizeExtractionImageOrientation(file)).toBe(file);
  });
});
