import type { Deal } from '../../api/types';
import { STAGE_LABELS } from '../../domain/stages';
import { usePipeline } from '../../services';
import { isOutOfPlace } from '../../sync/store';

/** Whether a teammate's change has left this deal out of place in the frozen view. */
export function useOutOfPlace(id: string): boolean {
  return usePipeline((state) => isOutOfPlace(state, id));
}

/** "Moved to Won by Rahul", shown on a dimmed card or row until the user refreshes. */
export function outOfPlaceNote(deal: Deal, listedStage: string | undefined): string {
  return listedStage !== deal.stage
    ? `Moved to ${STAGE_LABELS[deal.stage]} by ${deal.updatedBy}`
    : `Changed by ${deal.updatedBy}`;
}

/**
 * A brief highlight when a teammate changes this deal. Keyed by arrival time, so each new change
 * remounts it and replays the animation. Decorative only; screen readers aren't interrupted.
 */
export function RemoteFlash({ id }: { id: string }) {
  const changedAt = usePipeline((state) => state.remoteChanges.get(id));
  return changedAt ? (
    <span
      key={changedAt}
      className="pointer-events-none absolute inset-0 animate-remote-flash rounded-[inherit] bg-amber-100 motion-reduce:animate-none motion-reduce:opacity-0"
      aria-hidden="true"
    />
  ) : null;
}
