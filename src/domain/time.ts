export const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days from `from` to `to`; negative if `to` is earlier. */
export function daysBetween(from: number, to: number): number {
  return Math.floor((to - from) / DAY_MS);
}
