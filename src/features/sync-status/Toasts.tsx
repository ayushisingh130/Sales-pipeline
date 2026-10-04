import { useEffect } from 'react';
import { usePipeline } from '../../services';
import type { Toast } from '../../sync/store';

const DISMISS_AFTER_MS = { info: 5_000, error: 10_000 };

/** Short-lived notices. Also the live region that announces moves and failures to screen readers. */
export function Toasts() {
  const toasts = usePipeline((state) => state.toasts);
  return (
    <div className="toasts" role="status" aria-live="polite">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </div>
  );
}

function ToastItem({ toast }: { toast: Toast }) {
  const dismiss = usePipeline((state) => state.dismissToast);

  useEffect(() => {
    const timer = setTimeout(() => dismiss(toast.id), DISMISS_AFTER_MS[toast.tone]);
    return () => clearTimeout(timer);
  }, [toast, dismiss]);

  return (
    <div className={`toast toast-${toast.tone}`}>
      <span>{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          onClick={() => {
            toast.action?.run();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button type="button" aria-label="Dismiss" onClick={() => dismiss(toast.id)}>
        ×
      </button>
    </div>
  );
}
