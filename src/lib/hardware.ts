export interface HardwareCapabilities {
  webCodecsAv1: boolean;
  webGpu: boolean;
}

export async function probeHardwareSupport(): Promise<HardwareCapabilities> {
  let webCodecsAv1 = false;
  let webGpu = false;

  if (typeof VideoEncoder !== 'undefined') {
    try {
      const support = await VideoEncoder.isConfigSupported({
        codec: 'av01.0.04M.08',
        width: 1920,
        height: 1080,
      });
      webCodecsAv1 = support.supported === true;
    } catch {
      webCodecsAv1 = false;
    }
  }

  if (typeof navigator !== 'undefined' && 'gpu' in navigator) {
    try {
      const gpu = (navigator as unknown as { gpu: { requestAdapter: () => Promise<unknown> } }).gpu;
      if (gpu) {
        const adapter = await gpu.requestAdapter();
        webGpu = !!adapter;
      }
    } catch {
      webGpu = false;
    }
  } else {
    webGpu = false;
  }

  return { webCodecsAv1, webGpu };
}
