export const WORKER_IDLE_TIMEOUT_MS = 30_000;
export const MIN_WORKER_STAGGER_MS = 1_000;   // Delay between spawning the first MIN workers
export const DYNAMIC_SCALE_DELAY_MS = 1_000; // Delay before opening a dynamic worker above MIN
