import { observable } from "@legendapp/state";

interface PreviewState {
  itemId: string;
  selectedResultId: string;
}

export const preview$ = observable<PreviewState | null>(null)
