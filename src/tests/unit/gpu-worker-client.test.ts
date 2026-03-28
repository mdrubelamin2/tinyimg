import { describe, it, expect } from 'vitest';
import { GpuResizeClient } from '../../lib/gpu/gpu-worker-client';

describe('GPU Worker Client', () => {
  it('can be instantiated', () => {
    const client = new GpuResizeClient();
    expect(client).toBeDefined();
  });
});
