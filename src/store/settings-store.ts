/**
 * Settings store: persisted global options via Zustand + localStorage.
 * Separated from image state to keep settings independent of queue lifecycle.
 */

import { create } from 'zustand'
import { createJSONStorage, persist } from 'zustand/middleware'

import type { GlobalOptions } from '@/constants'

import { DEFAULT_GLOBAL_OPTIONS } from '@/constants'
import { safeLocalStorage } from '@/lib/safe-local-storage'

const STORAGE_KEY = 'tinyimg_config'

interface SettingsState {
  options: GlobalOptions
  resetToDefaults: () => void
  setOptions: (options: GlobalOptions) => void
  updateOption: <K extends keyof GlobalOptions>(key: K, value: GlobalOptions[K]) => void
}

/** Merge persisted options with current defaults (handles older localStorage without size fields). */
function mergePersistedOptions(stored: unknown): GlobalOptions {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_GLOBAL_OPTIONS }
  const o = stored as Partial<GlobalOptions>
  return {
    ...DEFAULT_GLOBAL_OPTIONS,
    ...o,
    customSizePresets:
      Array.isArray(o.customSizePresets) && o.customSizePresets.length > 0
        ? o.customSizePresets
        : DEFAULT_GLOBAL_OPTIONS.customSizePresets,
    formats: Array.isArray(o.formats) ? o.formats : DEFAULT_GLOBAL_OPTIONS.formats,
    includeNativeSizeInCustom:
      typeof o.includeNativeSizeInCustom === 'boolean'
        ? o.includeNativeSizeInCustom
        : DEFAULT_GLOBAL_OPTIONS.includeNativeSizeInCustom,
    losslessEncoding:
      o.losslessEncoding === 'none' ||
      o.losslessEncoding === 'all' ||
      o.losslessEncoding === 'custom_sizes_only'
        ? o.losslessEncoding
        : DEFAULT_GLOBAL_OPTIONS.losslessEncoding,
    useOriginalSizes:
      typeof o.useOriginalSizes === 'boolean'
        ? o.useOriginalSizes
        : DEFAULT_GLOBAL_OPTIONS.useOriginalSizes,
  }
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      options: { ...DEFAULT_GLOBAL_OPTIONS },
      resetToDefaults: () => set({ options: { ...DEFAULT_GLOBAL_OPTIONS } }),
      setOptions: (options) => set({ options }),
      updateOption: (key, value) =>
        set((state) => ({ options: { ...state.options, [key]: value } })),
    }),
    {
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsState> | undefined
        return {
          ...current,
          ...p,
          options: mergePersistedOptions(p?.options),
        }
      },
      name: STORAGE_KEY,
      partialize: (state) => ({ options: state.options }),
      storage: createJSONStorage(() => safeLocalStorage),
    },
  ),
)
