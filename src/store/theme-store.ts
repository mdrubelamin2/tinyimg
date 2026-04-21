import { readStoredTheme, resolveTheme, type StoredTheme } from "@/bootstrap/theme-dom";
import { computed, observable } from "@legendapp/state";

export const theme$ = observable<StoredTheme>(() => readStoredTheme());

export const resolvedTheme$ = computed(() => {
  const theme = theme$.get();
  return resolveTheme(theme);
});
