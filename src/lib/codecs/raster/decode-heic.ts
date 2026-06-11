import { ensureHeicDecoder } from '@/workers/optimizer-wasm'

/**
 * Decodes HEIC/HEIF buffer to ImageData.
 * Uses icodec's heic module which wraps libde265 via WASM.
 */
export async function decodeHeic(buffer: ArrayBuffer): Promise<ImageData> {
  await ensureHeicDecoder()
  const { heic } = await import('icodec')
  return heic.decode(new Uint8Array(buffer))
}
