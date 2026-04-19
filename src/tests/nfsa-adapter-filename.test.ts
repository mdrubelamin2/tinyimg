import { describe, expect, it } from 'vitest';
import { fileNameToKey, toFileName } from '@/storage/nfsa-storage-filename';

describe('nfsa-adapter filename encoding', () => {
  it('round-trips session-style keys', () => {
    const keys = ['out:abc12345:webp', 'src:abc12345', 'zip:batch1'];
    for (const key of keys) {
      const name = toFileName(key);
      expect(fileNameToKey(name)).toBe(key);
    }
  });

  it('uses tinyimg prefix and hex payload', () => {
    const name = toFileName('out:x:y:z');
    expect(name).toMatch(/^tinyimg[0-9a-f]+$/);
    expect(name.slice('tinyimg'.length)).not.toMatch(/[^0-9a-f]/);
  });

  it('rejects non-tinyimg-hex names', () => {
    expect(fileNameToKey('1ab')).toBeNull();
    expect(fileNameToKey('2xxx')).toBeNull();
  });
});
