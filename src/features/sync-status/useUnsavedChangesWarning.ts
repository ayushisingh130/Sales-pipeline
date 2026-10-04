import { useEffect } from 'react';
import { usePipeline } from '../../services';

/** The browser's "Leave site?" prompt while any change is still saving or unsaved. */
export function useUnsavedChangesWarning() {
  const hasPending = usePipeline((state) => state.pending.size > 0);

  useEffect(() => {
    if (!hasPending) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [hasPending]);
}
