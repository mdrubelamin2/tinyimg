import { describe, expect, it, vi } from 'vitest'

import { probeHardwareSupport } from '../../lib/hardware'

describe('Hardware Support', () => {
  it('returns false for everything when APIs are missing', async () => {
    vi.stubGlobal('VideoEncoder', undefined)
    vi.stubGlobal('navigator', { gpu: undefined })

    const capabilities = await probeHardwareSupport()
    expect(capabilities.webCodecsAv1).toBe(false)
    expect(capabilities.webGpu).toBe(false)
  })
})
