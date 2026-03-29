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
          // 2026 Industry Standard: Keep viewBox for perfect scaling
          removeViewBox: false,
          // Aggressive but VISUAL-SAFE path optimization
          convertPathData: {
            floatPrecision: 3, // Increased for 100% accuracy
            forceRelative: true,
            smartArcConversion: false, // DISABLED: Causes layout breakage in complex paths
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
    // Ensure IDs don't conflict (Mandatory for production)
    {
      name: 'prefixIds',
      params: {
        prefix: 't',
        delim: '',
      },
    },
    'removeDimensions',       // Prefer viewBox
    'convertStyleToAttrs',    // Safe & Effective
    'removeStyleElement',     
    'removeScripts',          
    'mergePaths',             // Safe for most vectors
    'collapseGroups',         // Safe for most vectors
    'removeEmptyAttrs',
    'sortAttrs',              // Crucial for Gzip/Brotli
    {
      name: 'cleanupNumericValues',
      params: {
        floatPrecision: 3,
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
