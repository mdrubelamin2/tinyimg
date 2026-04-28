import type { AllRasterFormat } from '@/lib/codecs/raster/types'

import { encodeSvgRasterForOutput } from '@/lib/codecs/raster/output-encode'
import { resizeImageDataHighQuality } from '@/lib/codecs/raster/resize-jsquash'

import type { EncoderResult, EncoderStrategy, OptimizeTaskInput } from './encoder-types'

import { svgPipelineOptionsFromWorker } from './encoder-types'
import { checkPixelLimit } from './raster-encode'
import { resolveResizeTarget } from './resize-preset'
import {
  assertEncodedDimensions,
  isSvgRasterFormat,
  processSvg,
  rasterizeSvgFileToImageData,
} from './svg-pipeline'

export class SvgEncoderStrategy implements EncoderStrategy {
  async encode(input: OptimizeTaskInput): Promise<EncoderResult> {
    const { buffer, options } = input
    const requestedFormat = options.format

    if (isSvgRasterFormat(requestedFormat)) {
      const svgOpts = svgPipelineOptionsFromWorker(options)
      const rasterPack = await rasterizeSvgFileToImageData(buffer, svgOpts)
      let imageData = rasterPack.imageData
      const srcW = imageData.width
      const srcH = imageData.height

      const target = resolveResizeTarget(imageData.width, imageData.height, options.resizePreset)
      if (target && (target.width !== imageData.width || target.height !== imageData.height)) {
        imageData = await resizeImageDataHighQuality(imageData, target.width, target.height)
      }

      checkPixelLimit(imageData.width, imageData.height)

      const format = requestedFormat as AllRasterFormat
      const { data: bytes, lossless } = await encodeSvgRasterForOutput(imageData, format, {
        losslessEncoding: options.losslessEncoding,
        resizePreset: options.resizePreset,
        srcH,
        srcW,
      })

      const mt = format === 'jpeg' ? 'image/jpeg' : `image/${format}`
      await assertEncodedDimensions(bytes, mt, imageData.width, imageData.height)

      return {
        encodedBytes: bytes,
        isLossless: lossless,
        label: `${format}`,
        mimeType: mt,
      }
    } else {
      const res = await processSvg(buffer, svgPipelineOptionsFromWorker(options))
      return {
        encodedBytes: await res.blob.arrayBuffer(),
        isLossless: true,
        label: res.label,
        mimeType: res.blob.type || 'image/svg+xml',
      }
    }
  }
}
