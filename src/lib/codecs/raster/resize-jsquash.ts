/**
 * High-quality raster resize (Squoosh / Lanczos) for worker pipeline.
 */

import resize from '@jsquash/resize'

export async function resizeImageDataHighQuality(
  data: ImageData,
  width: number,
  height: number,
): Promise<ImageData> {
  if (data.width === width && data.height === height) return data
  return resize(data, {
    fitMethod: 'stretch',
    height,
    method: 'lanczos3',
    width,
  })
}
