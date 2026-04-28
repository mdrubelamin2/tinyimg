import type { RasterEncodePreset } from '@/lib/codecs/raster/types'

import {
  applyScaleBoostToPreset,
  computeDownscaleRatio,
  qualityBoostFromRatio,
} from '@/lib/codecs/raster/adaptive-quality'
import { encodeBitmapRasterForOutput } from '@/lib/codecs/raster/output-encode'
import { PRESETS } from '@/lib/codecs/raster/presets'
import { resizeImageDataHighQuality } from '@/lib/codecs/raster/resize-jsquash'

import type { EncoderResult, EncoderStrategy, OptimizeTaskInput } from './encoder-types'

import { decodeHeic } from '../lib/codecs/raster/decode-heic'
import { classifyContent } from './classify'
import { checkPixelLimit, getImageData, normalizeOutputFormat } from './raster-encode'
import { resolveResizeTarget } from './resize-preset'

export class BitmapEncoderStrategy implements EncoderStrategy {
  async encode(input: OptimizeTaskInput): Promise<EncoderResult> {
    const { buffer, options } = input
    const finalFormat = normalizeOutputFormat(options.format, options.originalExtension)

    let imageData: ImageData
    const isHeifInput = options.originalExtension === 'heic' || options.originalExtension === 'heif'

    if (isHeifInput) {
      imageData = await decodeHeic(buffer)
    } else {
      let imageBitmap: ImageBitmap
      try {
        imageBitmap = await createImageBitmap(new Blob([buffer]))
      } catch {
        throw new Error('Unsupported or corrupt image')
      }
      imageData = await getImageData(imageBitmap)
      try {
        imageBitmap.close()
      } catch {
        /* ignore */
      }
    }

    checkPixelLimit(imageData.width, imageData.height)

    const srcW = imageData.width
    const srcH = imageData.height

    const target = resolveResizeTarget(imageData.width, imageData.height, options.resizePreset)
    if (target && (target.width !== imageData.width || target.height !== imageData.height)) {
      imageData = await resizeImageDataHighQuality(imageData, target.width, target.height)
    }

    checkPixelLimit(imageData.width, imageData.height)
    const preset = classifyContent(imageData)

    const effectiveFormat = finalFormat === 'svg' ? 'webp' : finalFormat
    const fmt = effectiveFormat as 'avif' | 'heic' | 'heif' | 'jpeg' | 'png' | 'webp'
    const downscaleRatio = computeDownscaleRatio(srcW, srcH, imageData.width, imageData.height)
    const boost = qualityBoostFromRatio(downscaleRatio)
    const boostedByContent =
      boost > 0 && (fmt === 'avif' || fmt === 'webp' || fmt === 'jpeg' || fmt === 'png')
        ? {
            photo: applyScaleBoostToPreset(
              PRESETS.photo as unknown as RasterEncodePreset,
              fmt,
              boost,
              'photo',
            ),
            ...(preset === 'graphic'
              ? {
                  graphic: applyScaleBoostToPreset(
                    PRESETS.graphic as unknown as RasterEncodePreset,
                    fmt,
                    boost,
                    'graphic',
                  ),
                }
              : {}),
          }
        : undefined

    const { data: bytesArray, lossless } = await encodeBitmapRasterForOutput(
      imageData,
      effectiveFormat,
      {
        losslessEncoding: options.losslessEncoding,
        preset,
        resizePreset: options.resizePreset,
        ...(boostedByContent === undefined ? {} : { boostedByContent }),
      },
    )

    const mimeFormat = effectiveFormat === 'jpeg' ? 'jpeg' : effectiveFormat
    return {
      encodedBytes: bytesArray,
      isLossless: lossless,
      label: effectiveFormat,
      mimeType: `image/${mimeFormat}`,
    }
  }
}
