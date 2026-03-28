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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tidyResult = (svgtidyOptimize as any)(svgText, {
      remove_metadata: true,
      strip_comments: true,
      enable_viewboxing: true, // true here means keep/normalize the viewBox
      shorten_ids: true,
      strip_ids: true,
      precision: 1, // Aggressive precision
    });
    if (typeof tidyResult === 'string' && tidyResult.length > 0) {
      const tidySize = new TextEncoder().encode(tidyResult).length;
      const svgoData = await runSvgoFallback(svgText);
      const svgoSize = new TextEncoder().encode(svgoData).length;

      if (svgoSize < tidySize && svgoSize < originalSize) {
        return { data: svgoData, engine: 'svgo' };
      }

      if (tidySize < originalSize) {
        return { data: tidyResult, engine: 'svgtidy' };
      }
    }
  } catch {
    // svgtidy failed — fall through to SVGO
  }

  const svgoData = await runSvgoFallback(svgText);
  return { data: svgoData, engine: 'svgo' };
}

async function runSvgoFallback(svgText: string): Promise<string> {
  // SVGO fallback (slower but more thorough)
  try {
    const { optimize: svgoOptimize } = await import('svgo');
    const svgoResult = svgoOptimize(svgText, {
      multipass: true,
      plugins: [
        {
          name: 'preset-default',
          params: {
            overrides: {
              removeViewBox: false, // Keep the viewBox for scalability
              cleanupIDs: {
                minify: true, // shorten_ids = True
                remove: true, // strip_ids = True
              },
              convertPathData: {
                floatPrecision: 1, // Aggressive precision
                noSpaceAfterFlags: true, // Extreme compression
                forceRelative: true,
              },
            },
          },
        } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
        'removeDimensions', // Use viewBox instead of fixed dimensions
        'removeStyleElement',
        'removeScripts',
        'mergePaths',
        'collapseGroups',
        'removeEmptyAttrs',
        'removeRedundantAttrs',
        'sortAttrs',
        {
          name: 'convertColors',
          params: {
            shorthex: true,
            rgb2hex: true,
          },
        },
        {
          name: 'cleanupNumericValues',
          params: {
            floatPrecision: 1,
          },
        },
        {
          name: 'convertShapeToPath',
          params: {
            convertArcs: true,
          },
        },
      ],
    });
    if (svgoResult.data && svgoResult.data.length > 0) {
      return svgoResult.data;
    }
  } catch {
    // ignore
  }
  return svgText;
}

/**
 * Quick size comparison: returns bytes of a UTF-8 string.
 */
export function svgByteLength(svg: string): number {
  return new TextEncoder().encode(svg).length;
}
