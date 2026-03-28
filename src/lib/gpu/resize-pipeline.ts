import { initGpuDevice } from './gpu-device';
import resizeShader from './shaders/resize.wgsl?raw';

interface ResizePipeline {
  bindGroup: GPUBindGroup;
  pipeline: GPUComputePipeline;
}

export async function createResizePipeline(
  inputWidth: number,
  inputHeight: number,
  outputWidth: number,
  outputHeight: number
): Promise<ResizePipeline | null> {
  const device = await initGpuDevice();
  if (!device) return null;

  const inputTex = device.createTexture({
    size: [inputWidth, inputHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST,
  });

  const outputTex = device.createTexture({
    size: [outputWidth, outputHeight],
    format: 'rgba8unorm',
    usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
  });

  const paramsBuffer = device.createBuffer({
    size: 16,
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
  });

  const paramsData = new Float32Array([
    inputWidth / outputWidth,
    inputHeight / outputHeight,
    inputWidth,
    inputHeight,
  ]);
  device.queue.writeBuffer(paramsBuffer, 0, paramsData);

  const bindGroupLayout = device.createBindGroupLayout({
    entries: [
      { binding: 0, visibility: GPUShaderStage.COMPUTE, texture: {} },
      { binding: 1, visibility: GPUShaderStage.COMPUTE, storageTexture: { access: 'write-only', format: 'rgba8unorm' } },
      { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: 'uniform' } },
    ],
  });

  const bindGroup = device.createBindGroup({
    layout: bindGroupLayout,
    entries: [
      { binding: 0, resource: inputTex.createView() },
      { binding: 1, resource: outputTex.createView() },
      { binding: 2, resource: { buffer: paramsBuffer } },
    ],
  });

  const pipeline = device.createComputePipeline({
    layout: device.createPipelineLayout({ bindGroupLayouts: [bindGroupLayout] }),
    compute: {
      module: device.createShaderModule({ code: resizeShader }),
      entryPoint: 'resizeMain',
    },
  });

  return { bindGroup, pipeline };
}
