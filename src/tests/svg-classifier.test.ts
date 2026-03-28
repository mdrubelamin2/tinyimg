import { describe, it, expect } from 'vitest';
import { classifySvg } from '../lib/optimizer/svg-classifier';

describe('classifySvg', () => {
  it('should classify a simple SVG as SIMPLE', () => {
    const svg = '<rect x="0" y="0" width="10" height="10" />';
    const result = classifySvg(svg);
    expect(result.type).toBe('SIMPLE');
    expect(result.stats.nodes).toBe(1);
  });

  it('should classify an SVG with <image> as HYBRID', () => {
    const svg = '<svg><image href="foo.png" /></svg>';
    const result = classifySvg(svg);
    expect(result.type).toBe('HYBRID');
  });

  it('should classify an SVG with many nodes as COMPLEX', () => {
    const svg = '<rect />'.repeat(1501);
    const result = classifySvg(svg);
    expect(result.type).toBe('COMPLEX');
    expect(result.stats.nodes).toBe(1501);
  });

  it('should classify an SVG with many segments as COMPLEX', () => {
    const svg = '<path d="' + 'M 0 0 L 10 10 '.repeat(2501) + '" />';
    const result = classifySvg(svg);
    // Each 'L' and 'M' are segments (letters a-df-z)
    // 2501 * 2 = 5002 segments
    expect(result.type).toBe('COMPLEX');
    expect(result.stats.segments).toBeGreaterThan(5000);
  });

  it('should classify an SVG with many filters as COMPLEX', () => {
    const svg = '<filter />'.repeat(6);
    const result = classifySvg(svg);
    expect(result.type).toBe('COMPLEX');
    expect(result.stats.filters).toBe(6);
  });
});
