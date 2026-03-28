let cachedDevice: GPUDevice | null = null;

export async function isGpuAvailable(): Promise<boolean> {
  if (typeof navigator === 'undefined' || !('gpu' in navigator)) {
    return false;
  }
  try {
    const adapter = await navigator.gpu.requestAdapter();
    return !!adapter;
  } catch {
    return false;
  }
}

export async function initGpuDevice(): Promise<GPUDevice | null> {
  if (cachedDevice) {
    return cachedDevice;
  }
  
  if (!('gpu' in navigator)) {
    return null;
  }
  
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return null;
    }
    
    cachedDevice = await adapter.requestDevice({
      requiredLimits: {
        maxTextureDimension2D: 16384,
        maxComputeWorkgroupStorageSize: 32768,
      },
    });
    
    return cachedDevice;
  } catch {
    return null;
  }
}

export function getGpuLimits() {
  return cachedDevice?.limits ?? null;
}
