/**
 * TypeScript declarations for Scheduler API
 */

export type TaskPriority = 'user-blocking' | 'user-visible' | 'background';

export interface SchedulerPostTaskOptions {
  priority?: TaskPriority;
  delay?: number;
  signal?: AbortSignal;
}

declare global {
  interface Scheduler {
    postTask<T>(callback: () => T, options?: SchedulerPostTaskOptions): Promise<T>;
    yield(): Promise<void>;
  }

  const scheduler: Scheduler | undefined;
}

export {};
