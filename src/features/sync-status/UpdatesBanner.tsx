import { usePipeline } from '../../services';
import { countOutOfPlace } from '../../sync/store';

/**
 * "8 updates from teammates — Show (R)". It floats over the content rather than sitting in the
 * layout, so its appearing can't push the board down under the user's cursor.
 */
export function UpdatesBanner() {
  const count = usePipeline(countOutOfPlace);
  const refreshView = usePipeline((state) => state.refreshView);
  if (count === 0) return null;

  return (
    <div className="fixed top-2 left-1/2 z-15 flex -translate-x-1/2 items-center gap-2.5 rounded-full bg-accent py-1.5 pr-1.5 pl-4 text-white shadow-lg">
      <span>
        ↻ {count} update{count === 1 ? '' : 's'} from teammates
      </span>
      <button
        type="button"
        className="cursor-pointer rounded-full bg-white px-3 py-0.5 font-medium text-accent hover:bg-indigo-50"
        onClick={refreshView}
      >
        Show (R)
      </button>
    </div>
  );
}
