import { test, expect } from '@playwright/test';
import path from 'path';
import fs from 'fs';
import {
  E2E_DEFAULT_TIMEOUT_MS,
  E2E_OPTIMIZATION_TIMEOUT_MS,
} from './constants';

test.describe('TinyIMG Basic Flow', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('smoke: optimize one image and get success', async ({ page }) => {
    const filePath = path.join(process.cwd(), 'test-images', 'png-1.png');
    if (!fs.existsSync(filePath)) return;
    const dropzone = page.getByRole('button', { name: /drop files or click to choose/i });
    await expect(dropzone).toBeVisible();
    // Prefer direct input injection: Chromium may use showOpenFilePicker (no Playwright filechooser event).
    await dropzone.locator('input[type="file"]').setInputFiles(filePath);
    const row = page.locator('[data-testid^="queue-row-"]').first();
    await expect(row).toBeVisible({ timeout: E2E_DEFAULT_TIMEOUT_MS });
    await expect(row.getByTestId('filename')).toContainText('png-1.png');
    await expect(row.getByText(/KB/i).first()).toBeVisible({ timeout: E2E_OPTIMIZATION_TIMEOUT_MS });
  });

  test('should have the correct title', async ({ page }) => {
    await expect(page).toHaveTitle(/TinyIMG/);
  });

  test('should show the dropzone and hero section', async ({ page }) => {
    await expect(page.getByText(/Industrial grade optimization/)).toBeVisible();
    await expect(page.getByText(/Drop anywhere on the page or paste/i)).toBeVisible();
  });

  test('should show the config panel', async ({ page }) => {
    await expect(page.getByText('Config')).toBeVisible();
    await expect(page.getByText('Output Formats')).toBeVisible();
    await expect(page.getByText('Output sizes')).toBeVisible();
    await expect(page.getByText('SVG Internal Data')).toBeVisible();
  });

  test('custom formats × custom sizes yields multiple download chips', async ({ page, browserName }) => {
    test.skip(
      browserName === 'webkit',
      'WebKit often does not finish dual AVIF+WebP WASM encodes within CI timeouts'
    );
    test.setTimeout(120_000);
    const filePath = path.join(process.cwd(), 'test-images', 'png-1.png');
    if (!fs.existsSync(filePath)) return;

    await page.getByRole('button', { name: 'Custom' }).first().click();
    await page.getByRole('button', { name: 'AVIF' }).click();
    await page.getByRole('button', { name: 'Custom' }).nth(1).click();
    await page.getByRole('button', { name: /Apply to All/i }).click();

    const dropzone = page.getByRole('button', { name: /drop files or click to choose/i });
    await dropzone.locator('input[type="file"]').setInputFiles(filePath);

    const row = page.locator('[data-testid^="queue-row-"]').first();
    await expect(row).toBeVisible({ timeout: E2E_DEFAULT_TIMEOUT_MS });
    await expect(row.getByText(/KB/i).first()).toBeVisible({ timeout: E2E_OPTIMIZATION_TIMEOUT_MS });
    await expect(row.getByRole('button', { name: /^Download / })).toHaveCount(2, {
      timeout: E2E_OPTIMIZATION_TIMEOUT_MS,
    });
  });

  test('should render FAQ file-size entry', async ({ page }) => {
    await expect(page.getByText('What is the file size limit?')).toBeVisible();
  });

});
