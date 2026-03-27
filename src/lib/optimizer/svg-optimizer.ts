/**
 * SVG optimizer facade: svgtidy (WASM) as primary, SVGO as fallback.
 * svgtidy is 50-100× faster than SVGO for most SVGs.
 */

/**
 * Optimize SVG text using svgtidy first, falling back to SVGO.
 * Returns the smaller result.
 */
export async function optimizeSvg(svgText: string): Promise<{ data: string; engine: 'svgtidy' | 'svgo' }> {
  const originalSize = new TextEncoder().encode(svgText).length;

  // Try svgtidy first (much faster)
  try {
    const { optimize: svgtidyOptimize } = await import('svgtidy');
    const tidyResult = svgtidyOptimize(svgText);
    if (typeof tidyResult === 'string' && tidyResult.length > 0) {
      const tidySize = new TextEncoder().encode(tidyResult).length;
      if (tidySize < originalSize) {
        return { data: tidyResult, engine: 'svgtidy' };
      }
    }
  } catch {
    // svgtidy failed — fall through to SVGO
  }

  // SVGO fallback (slower but more thorough)
  try {
    const { optimize: svgoOptimize } = await import('svgo');
    const svgoResult = svgoOptimize(svgText, {
      multipass: true,
      plugins: ['preset-default', 'removeDimensions'],
    });
    if (svgoResult.data && svgoResult.data.length > 0) {
      return { data: svgoResult.data, engine: 'svgo' };
    }
  } catch {
    // Both failed — return original
  }

  return { data: svgText, engine: 'svgo' };
}

/**
 * Quick size comparison: returns bytes of a UTF-8 string.
 */
export function svgByteLength(svg: string): number {
  return new TextEncoder().encode(svg).length;
}
