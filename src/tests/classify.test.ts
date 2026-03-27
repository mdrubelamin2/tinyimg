import { describe, it, expect } from 'vitest';
import { classifyContent } from '../workers/classify';

function makeImageData(width: number, height: number, fill: (i: number) => number): ImageData {
  const data = new Uint8ClampedArray(width * height * 4);
  for (let i = 0; i < data.length; i++) {
    data[i] = fill(i);
  }
  return { data, width, height, colorSpace: 'srgb' };
}

describe('classifyContent', () => {
  it('returns photo for very small image', () => {
    const small = makeImageData(10, 10, () => 128);
    expect(classifyContent(small)).toBe('photo');
  });

  it('returns photo or graphic (valid preset)', () => {
    const w = 200;
    const h = 200;
    const data = makeImageData(w, h, i => (i * 31 + 17) % 256);
    const preset = classifyContent(data);
    expect(preset === 'photo' || preset === 'graphic').toBe(true);
  });
});
