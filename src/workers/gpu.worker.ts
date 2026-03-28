import { initGpuDevice } from '../lib/gpu/gpu-device';
import { createResizePipeline } from '../lib/gpu/resize-pipeline';

self.onmessage = async (e: MessageEvent<{ type: string; payload: { bitmap: ImageBitmap; width: number; height: number } }>) => {
  const { type, payload } = e.data;

  if (type === 'resize') {
    const { bitmap, width, height } = payload;
    
    const device = await initGpuDevice();
    if (!device) {
      self.postMessage({ type: 'error', error: 'GPU unavailable' });
      return;
    }

    const inputTex = device.createTexture({
      size: [bitmap.width, bitmap.height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
    });

    device.queue.copyExternalImageToTexture(
      { source: bitmap },
      { texture: inputTex },
      [bitmap.width, bitmap.height]
    );

    const pipeline = await createResizePipeline(bitmap.width, bitmap.height, width, height);
    if (!pipeline) {
      self.postMessage({ type: 'error', error: 'Pipeline creation failed' });
      return;
    }

    const commandEncoder = device.createCommandEncoder();
    const pass = commandEncoder.beginComputePass();
    pass.setPipeline(pipeline.pipeline);
    pass.setBindGroup(0, pipeline.bindGroup);
    pass.dispatchWorkgroups(Math.ceil(width / 8), Math.ceil(height / 8));
    pass.end();

    const outputTex = device.createTexture({
      size: [width, height],
      format: 'rgba8unorm',
      usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
    });

    const readBuffer = device.createBuffer({
      size: width * height * 4,
      usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
    });

    commandEncoder.copyTextureToBuffer(
      { texture: outputTex },
      { buffer: readBuffer, bytesPerRow: width * 4 },
      [width, height]
    );

    const gpuCommands = commandEncoder.finish();
    device.queue.submit([gpuCommands]);

    await readBuffer.mapAsync(GPUMapMode.READ);
    const data = new Uint8ClampedArray(readBuffer.getMappedRange().slice(0));
    readBuffer.unmap();

    const imageData = new ImageData(data, width, height);
    self.postMessage({ type: 'result', imageData }, { transfer: [imageData.data.buffer] });
  }
};
