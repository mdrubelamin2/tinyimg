import { describe, it, expect } from 'vitest';
import {
  checkMagicBytesFromBuffer,
  validateZipSize,
  getMimeType,
} from '@/lib/validation';
import { MAX_ZIP_FILE_SIZE_BYTES } from '@/constants';

describe('validation', () => {
  describe('checkMagicBytesFromBuffer', () => {
    it('accepts PNG signature', async () => {
      // Minimal valid PNG with IHDR chunk
      const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, // PNG signature
        0x00, 0x00, 0x00, 0x0d, // IHDR length
        0x49, 0x48, 0x44, 0x52, // IHDR
        0x00, 0x00, 0x00, 0x01, // width
        0x00, 0x00, 0x00, 0x01, // height
        0x08, 0x02, 0x00, 0x00, 0x00 // bit depth, color type, etc
      ]);
      expect(await checkMagicBytesFromBuffer(png, 'png')).toBe(true);
    });
    it('accepts JPEG signature', async () => {
      // Minimal JPEG with SOI and SOF markers
      const jpeg = new Uint8Array([
        0xff, 0xd8, 0xff, 0xe0, // JPEG SOI + APP0
        0x00, 0x10, // APP0 length
        0x4a, 0x46, 0x49, 0x46, 0x00, // JFIF
        0x01, 0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00
      ]);
      expect(await checkMagicBytesFromBuffer(jpeg, 'jpg')).toBe(true);
    });
    it('rejects wrong extension', async () => {
      const png = new Uint8Array([
        0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a,
        0x00, 0x00, 0x00, 0x0d,
        0x49, 0x48, 0x44, 0x52,
        0x00, 0x00, 0x00, 0x01,
        0x00, 0x00, 0x00, 0x01,
        0x08, 0x02, 0x00, 0x00, 0x00
      ]);
      expect(await checkMagicBytesFromBuffer(png, 'jpg')).toBe(false);
    });
  });

  describe('validateZipSize', () => {
    it('allows size at limit', () => {
      expect(validateZipSize(MAX_ZIP_FILE_SIZE_BYTES)).toBe(true);
    });
    it('rejects over limit', () => {
      expect(validateZipSize(MAX_ZIP_FILE_SIZE_BYTES + 1)).toBe(false);
    });
  });

  describe('getMimeType', () => {
    it('returns MIME for known extensions', () => {
      expect(getMimeType('x.png')).toBe('image/png');
      expect(getMimeType('x.jpeg')).toBe('image/jpeg');
    });
  });
});
