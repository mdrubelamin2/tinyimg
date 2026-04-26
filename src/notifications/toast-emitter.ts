import { toast } from 'sonner';

/** Stable id so intake progress updates a single toast instead of stacking. */
export const INTAKE_PROGRESS_TOAST_ID = 'intake-progress';

export function syncIntakeProgressToast(
  active: boolean,
  label: string,
  processed: number,
  total: number
): void {
  if (!active) {
    toast.dismiss(INTAKE_PROGRESS_TOAST_ID);
    return;
  }
  const suffix = total > 0 ? ` (${processed}/${total})` : '';
  toast.loading(`${label}${suffix}`, {
    id: INTAKE_PROGRESS_TOAST_ID,
    duration: Infinity,
  });
}
