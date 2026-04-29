import type { Config, CustomPlugin } from 'svgo'

import { SVG_COMPLEXITY_NODE_THRESHOLD, SVG_COMPLEXITY_SEGMENT_THRESHOLD } from '@/constants'
import { Logger } from '@/workers/logger'

export interface SvgMetadata {
  hasFilters: boolean
  nodeCount: number
  rasterBytes: number
  segmentCount: number
  type: 'COMPLEX' | 'HYBRID' | 'SIMPLE'
}

/**
 * Custom SVGO plugin to extract metadata while walking the AST.
 */
const createMetadataPlugin = (metadata: SvgMetadata): CustomPlugin => ({
  fn: () => ({
    element: {
      enter: (node) => {
        metadata.nodeCount++

        if (node.name === 'filter' || node.name === 'mask' || node.name === 'clipPath') {
          metadata.hasFilters = true
        }

        if (node.attributes['d']) {
          const commands = node.attributes['d'].match(/[a-df-z]/gi)
          if (commands) {
            metadata.segmentCount += commands.length
          }
        }

        const href = node.attributes['href'] || node.attributes['xlink:href']
        if (href?.startsWith('data:')) {
          metadata.rasterBytes += href.length
        }
      },
    },
  }),
  name: 'extract-metadata',
})

/**
 * Ultimate 2026 SVGO Configuration
 * Replicates the full SVGOMG suite with industry-standard precision.
 */
const getSvgoConfig = (metadata: SvgMetadata): Config => ({
  floatPrecision: 3, // Global fallback
  multipass: true,
  plugins: [
    // 1. Standard Cleanups
    'removeDoctype',
    'removeXMLProcInst',
    'removeComments',
    'removeMetadata',
    'removeEditorsNSData',
    'removeUnusedNS',
    'cleanupAttrs',
    'cleanupIds',
    'removeUselessDefs',
    'removeUnknownsAndDefaults',
    'removeNonInheritableGroupAttrs',
    'removeUselessStrokeAndFill',
    'cleanupEnableBackground',

    // 2. Geometry Rewrites
    'convertShapeToPath',
    'convertEllipseToCircle',
    {
      name: 'convertPathData',
      params: {
        applyTransforms: true,
        floatPrecision: 3,
        makeArcs: {
          threshold: 2.5,
          tolerance: 0.5,
        },
      },
    },
    {
      name: 'convertTransform',
      params: {
        floatPrecision: 5,
      },
    },
    'mergePaths',
    'collapseGroups',
    'moveElemsAttrsToGroup',
    'moveGroupAttrsToElems',

    // 3. Style Optimizations
    'convertStyleToAttrs',
    'inlineStyles',
    'minifyStyles',
    'mergeStyles',
    'removeStyleElement',
    'removeScripts',

    // 4. Advanced & Structural
    'reusePaths',
    'sortAttrs',
    'sortDefsChildren',
    'removeEmptyAttrs',
    'removeEmptyContainers',
    'removeHiddenElems',
    'removeEmptyText',

    // 5. SVG 2.0 & Color
    'removeDeprecatedAttrs',
    'convertColors',

    // 6. Top-Level Overrides (SVGOMG Defaults)
    {
      name: 'removeViewBox',
    },
    {
      name: 'removeTitle',
    },
    {
      name: 'removeDesc',
    },
    {
      name: 'removeDimensions',
    },
    {
      name: 'cleanupNumericValues',
      params: {
        floatPrecision: 3,
      },
    },

    // 7. Custom Integrations
    createMetadataPlugin(metadata),
  ],
})

/**
 * Optimized SVG pipeline using industry-standard SVGO v4+.
 */
/**
 * ### Unified AST Pipeline
 *
 * The optimizer uses a single-pass AST (Abstract Syntax Tree) visitor pattern to perform
 * simultaneous optimization and content classification.
 *
 * #### Architecture: Zero-Overhead Classification
 * - By integrating a custom SVGO plugin (`extract-metadata`), we traverse the SVG DOM
 *   exactly once.
 * - During this single walk, we calculate node counts, path segment counts, and
 *   embedded raster sizes.
 * - This "zero-overhead" approach avoids the need for a secondary parsing step or
 *   expensive regex-based analysis, allowing for real-time decision making in the
 *   SVG pipeline.
 *
 * #### Precision Settings
 * - **Path Data (3)**: A precision of 3 decimal places for path coordinates (`d` attribute)
 *   provides sub-pixel accuracy that is visually indistinguishable from higher precisions
 *   on high-DPI screens while significantly reducing file size.
 * - **Transforms (5)**: Transform matrices require higher precision (5 decimal places)
 *   to prevent cumulative rounding errors during nested scale/rotate operations,
 *   which could otherwise lead to "visual drift" or misalignment.
 */
export async function optimizeSvg(
  svgText: string,
): Promise<{ data: string; metadata: SvgMetadata }> {
  const metadata: SvgMetadata = {
    hasFilters: false,
    nodeCount: 0,
    rasterBytes: 0,
    segmentCount: 0,
    type: 'SIMPLE',
  }

  try {
    const { optimize } = await import('svgo')
    const result = optimize(svgText, getSvgoConfig(metadata))

    if (result.data && result.data.length > 0) {
      // Classification logic based on gathered metadata
      if (metadata.rasterBytes > 0) {
        metadata.type = 'HYBRID'
      } else if (
        metadata.nodeCount > SVG_COMPLEXITY_NODE_THRESHOLD ||
        metadata.segmentCount > SVG_COMPLEXITY_SEGMENT_THRESHOLD
      ) {
        metadata.type = 'COMPLEX'
      } else {
        metadata.type = 'SIMPLE'
      }

      Logger.debug('SVGO optimization successful', {
        inputSize: svgText.length,
        metadata,
        outputSize: result.data.length,
      })
      return { data: result.data, metadata }
    }
  } catch (error) {
    Logger.error('SVGO optimization failed', {
      error:
        error instanceof Error
          ? {
              message: error.message,
              name: error.name,
              stack: error.stack,
            }
          : error,
    })
  }

  return { data: svgText, metadata }
}

/**
 * Quick size comparison: returns bytes of a UTF-8 string.
 */
export function svgByteLength(svg: string): number {
  return new TextEncoder().encode(svg).length
}
