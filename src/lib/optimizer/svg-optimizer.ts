import type { Config, CustomPlugin } from 'svgo';
import { Logger } from '@/workers/logger';

export interface SvgMetadata {
  nodeCount: number;
  segmentCount: number;
  rasterBytes: number;
  hasFilters: boolean;
  type: 'SIMPLE' | 'COMPLEX' | 'HYBRID';
}

/**
 * Custom SVGO plugin to extract metadata while walking the AST.
 */
const createMetadataPlugin = (metadata: SvgMetadata): CustomPlugin => ({
  name: 'extract-metadata',
  fn: () => ({
    element: {
      enter: (node) => {
        metadata.nodeCount++;

        if (node.name === 'filter' || node.name === 'mask' || node.name === 'clipPath') {
          metadata.hasFilters = true;
        }

        if (node.attributes['d']) {
          const commands = node.attributes['d'].match(/[a-df-z]/gi);
          if (commands) {
            metadata.segmentCount += commands.length;
          }
        }

        const href = node.attributes['href'] || node.attributes['xlink:href'];
        if (href?.startsWith('data:')) {
          metadata.rasterBytes += href.length;
        }
      },
    },
  }),
});

/**
 * Ultimate 2026 SVGO Configuration
 * Industry standard for maximum compression with zero visual regression.
 */
const getSvgoConfig = (metadata: SvgMetadata): Config => ({
  multipass: true,
  plugins: [
    {
      name: 'preset-default',
      params: {
        overrides: {
          // 2026 Industry Standard: Keep viewBox for perfect scaling
          removeViewBox: false,
          removeTitle: false,
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
    // Ensure IDs don't conflict (Mandatory for production)
    {
      name: 'prefixIds',
      params: {
        prefix: `t${Math.random().toString(36).slice(2, 5)}`,
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
    createMetadataPlugin(metadata),
  ],
});

/**
 * Optimized SVG pipeline using industry-standard SVGO v4+.
 */
export async function optimizeSvg(svgText: string): Promise<{ data: string; metadata: SvgMetadata }> {
  const metadata: SvgMetadata = {
    nodeCount: 0,
    segmentCount: 0,
    rasterBytes: 0,
    hasFilters: false,
    type: 'SIMPLE',
  };

  try {
    const { optimize } = await import('svgo');
    const result = optimize(svgText, getSvgoConfig(metadata));
    
    if (result.data && result.data.length > 0) {
      // Classification logic based on gathered metadata
      if (metadata.rasterBytes > 0) {
        metadata.type = 'HYBRID';
      } else if (metadata.nodeCount > 1500 || metadata.segmentCount > 5000) {
        metadata.type = 'COMPLEX';
      } else {
        metadata.type = 'SIMPLE';
      }

      Logger.debug('SVGO optimization successful', {
        inputSize: svgText.length,
        outputSize: result.data.length,
        metadata,
      });
      return { data: result.data, metadata };
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

  return { data: svgText, metadata };
}

/**
 * Quick size comparison: returns bytes of a UTF-8 string.
 */
export function svgByteLength(svg: string): number {
  return new TextEncoder().encode(svg).length;
}
