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
    await page.evaluate(() => {
      performance.mark('e2e-drop-start')
    })

    const dropzone = page.getByRole('button', {
      name: /drop files or click to choose/i,
    })
    const t0 = Date.now()
    await dropzone.locator('input[type="file"]').setInputFiles(filePath)

    const row = page.locator('[data-testid^="queue-row-"]').first()
    await expect(row).toBeVisible({ timeout: E2E_DEFAULT_TIMEOUT_MS })

    await page.evaluate(() => {
      performance.mark('e2e-first-row')
    })

    await expect(row.getByText(/KB/i).first()).toBeVisible({
      timeout: E2E_OPTIMIZATION_TIMEOUT_MS,
    })

    const timing = await page.evaluate(() => {
      performance.mark('e2e-first-result')
      performance.measure('e2e-drop-to-row', 'e2e-drop-start', 'e2e-first-row')
      performance.measure('e2e-drop-to-result', 'e2e-drop-start', 'e2e-first-result')
      const toRow = performance.getEntriesByName('e2e-drop-to-row').at(-1)?.duration ?? 0
      const toResult = performance.getEntriesByName('e2e-drop-to-result').at(-1)?.duration ?? 0
      return { toResult, toRow }
    })

    const elapsedMs = Date.now() - t0
    expect(elapsedMs).toBeLessThan(45_000)
    expect(timing.toRow).toBeLessThan(10_000)
    expect(timing.toResult).toBeLessThan(45_000)
  })
})
