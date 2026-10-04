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
    <div className="updates-banner">
      <span>
        ↻ {count} update{count === 1 ? '' : 's'} from teammates
      </span>
      <button type="button" onClick={refreshView}>
        Show (R)
      </button>
    </div>
  );
}
