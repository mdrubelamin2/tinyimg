import { expect, test } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

import {
  E2E_BENCHMARK_CHIP_TIMEOUT_MS,
  E2E_BUTTON_ENABLED_TIMEOUT_MS,
  E2E_CHIP_VISIBLE_SHORT_MS,
  E2E_DOWNLOAD_WAIT_MS,
  E2E_PAGE_LOAD_TIMEOUT_MS,
  E2E_SIZE_TOLERANCE,
} from './constants'

const TEST_OUTPUT_DIR = path.join(process.cwd(), 'test-output')

const BYTES_PER_KB = 1024
const BYTES_PER_MB = 1024 * 1024
const BYTES_PER_GB = 1024 * 1024 * 1024

// Simple JSONC parser (removes comments)
function parseJSONC(text: string) {
  const clean = text.replaceAll(/\/\/.*$/gm, '').replaceAll(/\/\*[\s\S]*?\*\//g, '')
  return JSON.parse(clean)
}

// Helper to parse size strings from expected.jsonc
function parseSize(sizeStr: unknown): number {
  if (typeof sizeStr !== 'string') return 0
  const match = sizeStr.trim().match(/^(\d+(\.\d+)?)\s*([KMG]B)$/i)
  if (!match) return 0
  const val = Number.parseFloat(match[1] ?? '0')
  const unit = (match[3] ?? '').toUpperCase()
  if (unit === 'KB') return val * BYTES_PER_KB
  if (unit === 'MB') return val * BYTES_PER_MB
  if (unit === 'GB') return val * BYTES_PER_GB
  return val
}

const testImagesDirRoot = path.join(process.cwd(), 'test-images')
const sizeOverridesPath = path.join(testImagesDirRoot, 'size-overrides.jsonc')
const sizeOverrides: Record<string, Record<string, number>> = fs.existsSync(sizeOverridesPath)
  ? parseJSONC(fs.readFileSync(sizeOverridesPath, 'utf8'))
  : {}

test.describe('Industrial Benchmarking', () => {
  const expectedPath = path.join(testImagesDirRoot, 'expected.jsonc')
  const expectedData = parseJSONC(fs.readFileSync(expectedPath, 'utf8'))
  const testImagesDir = testImagesDirRoot

  test.beforeEach(async ({ page }) => {
    test.slow()
    fs.mkdirSync(TEST_OUTPUT_DIR, { recursive: true })
    await page.goto('/', {
      timeout: E2E_PAGE_LOAD_TIMEOUT_MS,
      waitUntil: 'load',
    })

    // Select Custom formats if not already selected
    const originalBadge = page.locator('span:has-text("Original")')
    if (await originalBadge.isVisible()) {
      await originalBadge.click()
    }

    // Wait for buttons to become enabled
    await expect(page.locator('button:has-text("webp")').first()).toBeEnabled({
      timeout: E2E_BUTTON_ENABLED_TIMEOUT_MS,
    })

    const formats = ['webp', 'avif', 'jpeg', 'png']
    for (const f of formats) {
      const btn = page.locator(`button:has-text("${f}")`).first()
      const isActive = await btn.evaluate((el) => el.classList.contains('border-cta'))
      if (!isActive) {
        await btn.click()
      }
    }
    await page.click('text=Apply Industrial Config')
  })

  for (const [filename, expected] of Object.entries(expectedData)) {
    test(`should optimize ${filename} within expected limits`, async ({ page }) => {
      const filePath = path.join(testImagesDir, filename)
      if (!fs.existsSync(filePath)) return

      const [fileChooser] = await Promise.all([
        page.waitForEvent('filechooser'),
        page.getByRole('button', { name: 'Drop files or click to select' }).click(),
      ])
      await fileChooser.setFiles(filePath)

      const row = page
        .locator('tr')
        .filter({
          has: page.locator('td').first().locator(`text="${filename}"`).first(),
        })
        .first()
      await expect(row).toBeVisible({ timeout: E2E_PAGE_LOAD_TIMEOUT_MS })

      const expectedFormats =
        typeof expected === 'string' ? ['svg'] : Object.keys(expected as Record<string, string>)

      for (const format of expectedFormats) {
        const resultCell = row.locator('td').nth(2)
        const formatChip = resultCell
          .locator('div.rounded-xl')
          .filter({ hasText: new RegExp(format, 'i') })
          .first()
        const svgChip = resultCell.locator('div.rounded-xl').filter({ hasText: /svg/i }).first()
        const chipToUse = filename.endsWith('.svg') ? svgChip : formatChip

        if (
          filename.endsWith('.svg') &&
          !(await chipToUse.isVisible({ timeout: E2E_CHIP_VISIBLE_SHORT_MS }))
        ) {
          continue
        }

        await expect(chipToUse).toBeVisible({
          timeout: E2E_BENCHMARK_CHIP_TIMEOUT_MS,
        })
        await expect(chipToUse).toContainText('KB', {
          timeout: E2E_BENCHMARK_CHIP_TIMEOUT_MS,
        })

        const sizeText = await chipToUse.locator('span.text-xs').innerText()
        const actualSize = Number.parseFloat(sizeText.replace(' KB', '')) * BYTES_PER_KB

        const expectedSizeStr =
          typeof expected === 'string' ? expected : (expected as Record<string, string>)[format]
        const expectedSizeBytes = parseSize(expectedSizeStr)

        // Skip size check when baseline is missing for this (file, format); see DESIGN-perfect-optimizer.md.
        if (expectedSizeBytes > 0) {
          const formatKey = format.toLowerCase()
          const tolerance = sizeOverrides[filename]?.[formatKey] ?? E2E_SIZE_TOLERANCE
          expect(actualSize).toBeLessThanOrEqual(expectedSizeBytes * tolerance)
        }

        // Export optimized file for quality gate (in-browser artifact)
        const downloadLink = chipToUse.locator('a[href]').first()
        if (await downloadLink.isVisible().catch(() => false)) {
          const ext = format === 'jpeg' ? 'jpg' : format
          const base = path.basename(filename, path.extname(filename))
          const outPath = path.join(TEST_OUTPUT_DIR, `${base}.${ext}`)
          const [download] = await Promise.all([
            page.waitForEvent('download', { timeout: E2E_DOWNLOAD_WAIT_MS }),
            downloadLink.click(),
          ])
          await download.saveAs(outPath)
        }
      }
    })
  }
})
