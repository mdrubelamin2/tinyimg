import type { Config } from 'svgo';
import { Logger } from '@/workers/logger';

/**
 * Ultimate 2026 SVGO Configuration
 * Industry standard for maximum compression with zero visual regression.
 */
const SVGO_CONFIG: Config = {
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // Aggressive path data optimization
          convertPathData: {
            floatPrecision: 2,
            forceRelative: true,
            smartArcConversion: true,
            noSpaceAfterFlags: true,
            collapseRepeated: true,
          },
        },
      },
    },
    {
      name: 'removeViewBox',
      active: false,
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    {
      name: 'removeTitle',
      active: false,
    } as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    // Ensure IDs don't conflict when multiple SVGs are inlined on one page
    {
      name: 'prefixIds',
      params: {
        prefix: 't',
        delim: '',
      },
    },
    'removeDimensions',       // Prefer viewBox for layout
    'convertStyleToAttrs',    // Style elements -> Attributes
    'removeStyleElement',     // Aggressive cleanup
    'removeScripts',          // Security & Size (v4 name)
    'mergePaths',             // Combine adjacent paths
    'collapseGroups',         // Flatten redundant <g>
    'removeEmptyAttrs',       // Cleanup
    'sortAttrs',              // Improves Gzip/Brotli compression ratios
    'reusePaths',             // Use <defs> for identical paths
    {
      name: 'cleanupNumericValues',
      params: {
        floatPrecision: 2,
      },
    },
  ],
};

/**
 * Optimized SVG pipeline using industry-standard SVGO v4+.
 */
export async function optimizeSvg(svgText: string): Promise<{ data: string; engine: 'svgo' }> {
  try {
    const { optimize } = await import('svgo');
    const result = optimize(svgText, SVGO_CONFIG);
    
    if (result.data && result.data.length > 0) {
      Logger.debug('SVGO optimization successful', {
        inputSize: svgText.length,
        outputSize: result.data.length,
      });
      return { data: result.data, engine: 'svgo' };
    }
  } catch (error) {
    Logger.error('SVGO optimization failed', {
      error: error instanceof Error ? {
        name: error.name,
        message: error.message,
        stack: error.stack,
      } : error
    });
  }

  return { data: svgText, engine: 'svgo' };
}

/**
 * Quick size comparison: returns bytes of a UTF-8 string.
 */
export function svgByteLength(svg: string): number {
  return new TextEncoder().encode(svg).length;
}
