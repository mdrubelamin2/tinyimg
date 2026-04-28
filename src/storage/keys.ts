export const srcKey = (id: string): string => `src:${id}`

export const outKey = (id: string, resultId: string): string => `out:${id}:${resultId}`

export const outKeyPrefix = (id: string): string => `out:${id}:`

export const zipKey = (batchId: string): string => `zip:${batchId}`

export const SESSION_KEY_PREFIXES = ['src:', 'out:', 'zip:'] as const

export const isSessionKey = (key: string): boolean =>
  SESSION_KEY_PREFIXES.some((p) => key.startsWith(p))
