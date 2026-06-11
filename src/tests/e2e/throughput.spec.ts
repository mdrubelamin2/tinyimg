import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import { E2E_DEFAULT_TIMEOUT_MS, E2E_OPTIMIZATION_TIMEOUT_MS } from './constants'

test.describe('TinyIMG throughput marks', () => {
  test('drop to first optimized output within generous ceiling', async ({ page }) => {
    test.setTimeout(90_000)
    const filePath = path.join(process.cwd(), 'test-images', 'png-1.png')
    if (!fs.existsSync(filePath)) return

    await page.goto('/')
    const dropzone = page.getByRole('button', {
      name: /drop files or click to choose/i,
    })
    const t0 = Date.now()
    await dropzone.locator('input[type="file"]').setInputFiles(filePath)

    const row = page.locator('[data-testid^="queue-row-"]').first()
    await expect(row).toBeVisible({ timeout: E2E_DEFAULT_TIMEOUT_MS })
    await expect(row.getByText(/KB/i).first()).toBeVisible({
      timeout: E2E_OPTIMIZATION_TIMEOUT_MS,
    })

    const elapsedMs = Date.now() - t0
    expect(elapsedMs).toBeLessThan(45_000)
  })
})
