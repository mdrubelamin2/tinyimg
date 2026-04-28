import { heic } from 'icodec'

/**
 * Decodes HEIC/HEIF buffer to ImageData.
 * Uses icodec's heic module which wraps libde265 via WASM.
 */
export async function decodeHeic(buffer: ArrayBuffer): Promise<ImageData> {
  return heic.decode(new Uint8Array(buffer))
}
