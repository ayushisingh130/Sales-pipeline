import { ApiError } from '../api/types';

export const MAX_ATTEMPTS = 3;
/** Saves take 0.3–1.5s; anything past 4s is treated as lost. */
export const REQUEST_TIMEOUT_MS = 4000;

export type FailureClass = 'transient' | 'conflict' | 'gone';

/** Transient failures are retried automatically; conflicts need the user; "gone" can't be saved at all. */
export function classifyError(error: unknown): FailureClass {
  if (error instanceof ApiError) {
    if (error.kind === 'conflict') return 'conflict';
    if (error.kind === 'not_found') return 'gone';
  }
  return 'transient';
}

/** 1s, 2s, 4s… with ±25% jitter, so a burst of failed saves doesn't retry in lockstep. */
export function backoffMs(failedAttempts: number, rng: () => number): number {
  return 1000 * 2 ** (failedAttempts - 1) * (0.75 + rng() * 0.5);
}

export async function withTimeout<T>(
  run: (signal: AbortSignal) => Promise<T>,
  timeoutMs: number,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await run(controller.signal);
  } finally {
    clearTimeout(timer);
  }
}

export const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export const errorMessage = (error: unknown) =>
  error instanceof Error ? error.message : String(error);
