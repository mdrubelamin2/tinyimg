import { describe, it, expect, vi } from 'vitest';
import { createResizePipeline } from '../../lib/gpu/resize-pipeline';

describe('Resize Pipeline', () => {
  it('returns null when GPU is unavailable', async () => {
    vi.stubGlobal('navigator', { gpu: undefined });
    const pipeline = await createResizePipeline(1920, 1080, 800, 600);
    expect(pipeline).toBeNull();
  });
});
