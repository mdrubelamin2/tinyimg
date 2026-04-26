/** Number of items to process before yielding to the UI thread during intake. */
export const INTAKE_UI_CHUNK = 40;

/** Number of original files to persist to storage in parallel. */
export const INTAKE_PERSIST_CONCURRENCY = 6;

/** Cooldown for storage persistence error toasts to avoid spamming the user. */
export const PERSIST_ERROR_TOAST_COOLDOWN_MS = 4000;

/** SVG Complexity Thresholds */
export const SVG_COMPLEXITY_NODE_THRESHOLD = 1500;
export const SVG_COMPLEXITY_SEGMENT_THRESHOLD = 5000;
