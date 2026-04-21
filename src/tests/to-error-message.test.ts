import { describe, expect, it } from 'vitest';
import { toErrorMessage } from '@/lib/codecs/raster/io';

describe('toErrorMessage', () => {
  it('uses Error.message', () => {
    expect(toErrorMessage(new Error('oops'), 'fb')).toBe('oops');
  });

  it('reads message from plain object throws (WASM-style)', () => {
    expect(toErrorMessage({ message: 'wasm failed' } as unknown, 'fb')).toBe('wasm failed');
  });

  it('handles empty plain object', () => {
    expect(toErrorMessage({}, 'fallback')).toContain('fallback');
    expect(toErrorMessage({}, 'fallback')).toContain('no details');
  });
});
