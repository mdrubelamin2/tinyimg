/**
 * 2026-standard structured logger for Worker environments.
 * Supports metadata, error causes, and dev-only verbosity.
 */
export const Logger = {
  debug(message: string, meta?: Record<string, unknown>) {
    if (import.meta.env.DEV) {
      console.info(`[Worker DEBUG] ${message}`, meta)
    }
  },
  error(message: string, meta?: Record<string, unknown>) {
    console.error(`[Worker ERROR] ${message}`, meta)
  },
  info(message: string, meta?: Record<string, unknown>) {
    if (import.meta.env.DEV) {
      console.info(`[Worker INFO] ${message}`, meta)
    }
  },
  warn(message: string, meta?: Record<string, unknown>) {
    console.warn(`[Worker WARN] ${message}`, meta)
  },
}
