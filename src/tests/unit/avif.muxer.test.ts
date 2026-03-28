import { describe, it, expect } from 'vitest';
import { muxAv1ToAvif } from '../../lib/codecs/avif.muxer';

describe('AVIF Muxer', () => {
  it('wraps a raw byte array in basic ISOBMFF boxes', () => {
    const rawChunk = new Uint8Array([0x01, 0x02, 0x03]);
    const avifBuffer = muxAv1ToAvif(rawChunk);
    
    const resultView = new Uint8Array(avifBuffer);
    
    expect(resultView[4]).toBe('f'.charCodeAt(0));
    expect(resultView[5]).toBe('t'.charCodeAt(0));
    expect(resultView[6]).toBe('y'.charCodeAt(0));
    expect(resultView[7]).toBe('p'.charCodeAt(0));
  });
});
