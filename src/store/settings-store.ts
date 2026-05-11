/**
 * Settings store: global options via Zustand.
 * Ephemeral state that resets on page refresh.
 * Separated from image state to keep settings independent of queue lifecycle.
 */

import { create } from 'zustand'

import type { GlobalOptions } from '@/constants'

import { DEFAULT_GLOBAL_OPTIONS } from '@/constants'

interface SettingsState {
  options: GlobalOptions
  resetToDefaults: () => void
  setOptions: (options: GlobalOptions) => void
  updateOption: <K extends keyof GlobalOptions>(key: K, value: GlobalOptions[K]) => void
}

export const useSettingsStore = create<SettingsState>()((set) => ({
  options: { ...DEFAULT_GLOBAL_OPTIONS },
  resetToDefaults: () => set({ options: { ...DEFAULT_GLOBAL_OPTIONS } }),
  setOptions: (options) => set({ options }),
  updateOption: (key, value) => set((state) => ({ options: { ...state.options, [key]: value } })),
}))
