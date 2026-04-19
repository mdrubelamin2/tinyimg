import { describe, it, expect } from 'vitest';
import { mimeForOutputFormat } from '@/constants';

describe('mimeForOutputFormat', () => {
  it.each([
    ['jpeg', 'image/jpeg'],
    ['jpg', 'image/jpeg'],
    ['png', 'image/png'],
    ['webp', 'image/webp'],
    ['avif', 'image/avif'],
    ['svg', 'image/svg+xml'],
    ['jxl', 'image/jxl'],
    ['foo', 'application/octet-stream'],
    ['', 'application/octet-stream'],
  ])('%s -> %s', (format, expected) => {
    expect(mimeForOutputFormat(format)).toBe(expected);
  });
});
