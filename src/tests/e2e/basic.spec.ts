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
    const [fileChooser] = await Promise.all([
      page.waitForEvent('filechooser'),
      dropzone.click(),
    ]);
    await fileChooser.setFiles(filePath);
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
    await expect(page.getByText('SVG Internal Data')).toBeVisible();
  });

  test('should render FAQ file-size entry', async ({ page }) => {
    await expect(page.getByText('What is the file size limit?')).toBeVisible();
  });

});
