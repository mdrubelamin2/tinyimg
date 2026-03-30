import { create } from 'zustand';

interface VisibilityState {
  visibleItemIds: Set<string>;
  setVisibleItems: (ids: string[]) => void;
  isVisible: (id: string) => boolean;
}

export const useVisibilityStore = create<VisibilityState>()((set, get) => ({
  visibleItemIds: new Set(),
  
  setVisibleItems: (ids: string[]) => {
    set({ visibleItemIds: new Set(ids) });
  },
  
  isVisible: (id: string) => {
    return get().visibleItemIds.has(id);
  },
}));