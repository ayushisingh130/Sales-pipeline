import { cx } from '../../cx';
import type { AttentionReason, ReasonKind } from '../../domain/priority';

/** Red and amber for the date reasons (act today), purple for no activity, neutral for value. */
const TONE: Record<ReasonKind, string> = {
  overdue: 'bg-red-50 font-medium text-red-700',
  closing_soon: 'bg-amber-50 font-medium text-amber-800',
  stale: 'bg-violet-50 font-medium text-violet-700',
  high_value: 'bg-slate-100 text-slate-600',
};

/**
 * Why a deal is in "Needs attention", as chips, most urgent first. Shared by cards and rows. One
 * line tall: a chip that doesn't fit wraps out of sight whole, never cut mid-word; the tooltip
 * lists them all. `compact` is for cards: smaller text and padding, so two chips fit in a
 * minimum-width (190px) column.
 */
export function AttentionSignals({
  reasons,
  compact = false,
}: {
  reasons: AttentionReason[];
  compact?: boolean;
}) {
  if (reasons.length === 0) return null;
  return (
    <span
      className={cx(
        'flex h-[18px] min-w-0 flex-wrap gap-1 overflow-hidden',
        compact ? 'text-[11px]/4' : 'text-xs/4',
      )}
      title={reasons.map((reason) => reason.label).join(' · ')}
    >
      {reasons.map((reason) => (
        <span
          key={reason.kind}
          className={cx(
            'rounded py-px whitespace-nowrap',
            compact ? 'px-1' : 'px-1.5',
            TONE[reason.kind],
          )}
        >
          {reason.label}
        </span>
      ))}
    </span>
  );
}
