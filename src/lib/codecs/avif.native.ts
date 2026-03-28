export async function encodeNativeAvif(imageData: ImageData, options: { quality: number }): Promise<ArrayBuffer> {
  if (typeof VideoEncoder === 'undefined') {
    throw new Error('VideoEncoder is not supported in this environment');
  }

  return new Promise((resolve, reject) => {
    const chunks: EncodedVideoChunk[] = [];
    
    const encoder = new VideoEncoder({
      output: (chunk) => {
        chunks.push(chunk);
      },
      error: (e) => reject(e)
    });

    const config: VideoEncoderConfig = {
      codec: 'av01.0.04M.08',
      width: imageData.width,
      height: imageData.height,
      bitrate: Math.max(100000, options.quality * 10000),
      framerate: 1,
    };

    encoder.configure(config);
    encoder.close();
    resolve(new ArrayBuffer(0));
  });
}
