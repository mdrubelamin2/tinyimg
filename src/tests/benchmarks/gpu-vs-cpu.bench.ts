import { bench, describe } from 'vitest';
import { GpuResizeClient } from '../../lib/gpu/gpu-worker-client';

describe('GPU vs CPU Resize', () => {
  bench('GPU resize 4K → 1080p', async () => {
    const client = new GpuResizeClient();
    const bitmap = await createImageBitmap(new OffscreenCanvas(3840, 2160));
    await client.resize(bitmap, 1920, 1080);
    client.terminate();
  });

  bench('CPU resize 4K → 1080p', async () => {
    const canvas = new OffscreenCanvas(3840, 2160);
    const target = new OffscreenCanvas(1920, 1080);
    const ctx = target.getContext('2d');
    ctx?.drawImage(canvas, 0, 0, 1920, 1080);
  });
});
