import { describe, it, expect } from 'vitest';
import {
  checkMagicBytesFromBufferExport,
  validateZipSize,
  getMimeType,
} from '../lib/validation';
import { MAX_ZIP_FILE_SIZE_BYTES } from '../constants';

describe('validation', () => {
  describe('checkMagicBytesFromBufferExport', () => {
    it('accepts PNG signature', () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(checkMagicBytesFromBufferExport(png, 'png')).toBe(true);
    });
    it('accepts JPEG signature', () => {
      const jpeg = new Uint8Array([0xff, 0xd8, 0xff]);
      expect(checkMagicBytesFromBufferExport(jpeg, 'jpg')).toBe(true);
    });
    it('rejects wrong extension', () => {
      const png = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
      expect(checkMagicBytesFromBufferExport(png, 'jpg')).toBe(false);
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
