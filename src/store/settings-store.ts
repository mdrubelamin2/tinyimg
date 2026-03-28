/**
 * Settings store: persisted global options via Zustand + localStorage.
 * Separated from image state to keep settings independent of queue lifecycle.
 */

import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { GlobalOptions } from '@/constants/index.ts';
import { DEFAULT_GLOBAL_OPTIONS } from '@/constants/index.ts';

const STORAGE_KEY = 'tinyimg_config';

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
    }
  )
);
