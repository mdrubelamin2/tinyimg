/**
 * E2E test constants: timeouts and tolerance.
 * Single source for Playwright specs to avoid magic numbers.
 */

export const E2E_DEFAULT_TIMEOUT_MS = 15000;
export const E2E_OPTIMIZATION_TIMEOUT_MS = 60000;
export const E2E_PAGE_LOAD_TIMEOUT_MS = 60000;
export const E2E_BUTTON_ENABLED_TIMEOUT_MS = 10000;
export const E2E_CHIP_VISIBLE_SHORT_MS = 5000;
export const E2E_BENCHMARK_CHIP_TIMEOUT_MS = 180000;
export const E2E_DOWNLOAD_WAIT_MS = 10000;

/** Size tolerance multiplier (e.g. 1.10 = 10% over expected allowed). */
export const E2E_SIZE_TOLERANCE = 1.1;
