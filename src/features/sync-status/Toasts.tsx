import { useEffect } from 'react';
import { cx } from '../../cx';
import { usePipeline } from '../../services';
import type { Toast } from '../../sync/store';

const DISMISS_AFTER_MS = { info: 5_000, error: 10_000 };

/** Short-lived notices. Also the live region that announces moves and failures to screen readers. */
export function Toasts() {
  const toasts = usePipeline((state) => state.toasts);
  return (
    <div
      className="fixed right-4 bottom-4 z-20 flex max-w-[min(420px,calc(100vw-32px))] flex-col gap-2"
      role="status"
      aria-live="polite"
    >
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
    <div
      className={cx(
        'flex items-center gap-2 rounded-lg px-3 py-2.5 text-white shadow-lg',
        toast.tone === 'error' ? 'bg-red-700' : 'bg-slate-900',
      )}
    >
      <span className="flex-1">{toast.message}</span>
      {toast.action && (
        <button
          type="button"
          className="btn btn-inverse"
          onClick={() => {
            toast.action?.run();
            dismiss(toast.id);
          }}
        >
          {toast.action.label}
        </button>
      )}
      <button
        type="button"
        className="cursor-pointer rounded px-1.5 text-white/70 hover:text-white"
        aria-label="Dismiss"
        onClick={() => dismiss(toast.id)}
      >
        ×
      </button>
    </div>
  );
}
