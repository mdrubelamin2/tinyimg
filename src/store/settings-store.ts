/**
 * Settings store: persisted global options using Jotai.
 * Migrated from custom store to use Jotai's atomWithStorage for consistency.
 */

import { atomWithStorage } from 'jotai/utils';
import type { GlobalOptions } from '@/constants/index.ts';
import { DEFAULT_GLOBAL_OPTIONS } from '@/constants/index.ts';

const STORAGE_KEY = 'tinyimg_config';

// Atom with localStorage persistence
export const settingsAtom = atomWithStorage<GlobalOptions>(
  STORAGE_KEY,
  DEFAULT_GLOBAL_OPTIONS,
  {
    getItem: (key, initialValue) => {
      try {
        const stored = localStorage.getItem(key);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...initialValue, ...parsed.options };
        }
      } catch (e) {
        console.warn('Failed to load settings from localStorage', e);
      }
      return initialValue;
    },
    setItem: (key, value) => {
      try {
        localStorage.setItem(key, JSON.stringify({ options: value }));
      } catch (e) {
        console.warn('Failed to save settings to localStorage', e);
      }
    },
    removeItem: (key) => {
      try {
        localStorage.removeItem(key);
      } catch (e) {
        console.warn('Failed to remove settings from localStorage', e);
      }
    },
  }
);
