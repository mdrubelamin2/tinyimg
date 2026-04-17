/**
 * Settings store: persisted global options via Zustand + localStorage.
 * Separated from image state to keep settings independent of queue lifecycle.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GlobalOptions } from '@/constants';
import { DEFAULT_GLOBAL_OPTIONS } from '@/constants';

const STORAGE_KEY = 'tinyimg_config';

/** Merge persisted options with current defaults (handles older localStorage without size fields). */
function mergePersistedOptions(stored: unknown): GlobalOptions {
  if (!stored || typeof stored !== 'object') return { ...DEFAULT_GLOBAL_OPTIONS };
  const o = stored as Partial<GlobalOptions>;
  return {
    ...DEFAULT_GLOBAL_OPTIONS,
    ...o,
    formats: Array.isArray(o.formats) ? o.formats : DEFAULT_GLOBAL_OPTIONS.formats,
    customSizePresets:
      Array.isArray(o.customSizePresets) && o.customSizePresets.length > 0
        ? o.customSizePresets
        : DEFAULT_GLOBAL_OPTIONS.customSizePresets,
    useOriginalSizes:
      typeof o.useOriginalSizes === 'boolean' ? o.useOriginalSizes : DEFAULT_GLOBAL_OPTIONS.useOriginalSizes,
    includeNativeSizeInCustom:
      typeof o.includeNativeSizeInCustom === 'boolean'
        ? o.includeNativeSizeInCustom
        : DEFAULT_GLOBAL_OPTIONS.includeNativeSizeInCustom,
  };
}

interface SettingsState {
  options: GlobalOptions;
  setOptions: (options: GlobalOptions) => void;
  updateOption: <K extends keyof GlobalOptions>(key: K, value: GlobalOptions[K]) => void;
  resetToDefaults: () => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      options: { ...DEFAULT_GLOBAL_OPTIONS },
      setOptions: (options) => set({ options }),
      updateOption: (key, value) =>
        set((state) => ({ options: { ...state.options, [key]: value } })),
      resetToDefaults: () => set({ options: { ...DEFAULT_GLOBAL_OPTIONS } }),
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({ options: state.options }),
      merge: (persisted, current) => {
        const p = persisted as Partial<SettingsState> | undefined;
        return {
          ...current,
          ...(p ?? {}),
          options: mergePersistedOptions(p?.options),
        };
      },
    }
  )
);
