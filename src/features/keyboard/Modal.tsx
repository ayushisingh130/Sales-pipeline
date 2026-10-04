import { useRef, type KeyboardEvent, type ReactNode } from 'react';
import { useFocusWhileMounted } from './focus';

interface ModalProps {
  labelledBy: string;
  onClose: () => void;
  children: ReactNode;
}

/**
 * A minimal modal dialog: focus moves in (to `data-autofocus`), Tab stays inside, Esc or a click
 * on the backdrop closes it, and focus returns afterwards. Not `<dialog>`: jsdom has no showModal().
 */
export function Modal({ labelledBy, onClose, children }: ModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useFocusWhileMounted(dialogRef);

  const onKeyDown = (event: KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.preventDefault();
      onClose();
    }
    if (event.key !== 'Tab') return;
    const focusable = Array.from(
      dialogRef.current?.querySelectorAll<HTMLElement>('button, input') ?? [],
    );
    const index = focusable.indexOf(document.activeElement as HTMLElement);
    focusable.at((index + (event.shiftKey ? -1 : 1)) % focusable.length)?.focus();
    event.preventDefault();
  };

  return (
    <div
      className="fixed inset-0 z-30 grid place-items-center bg-slate-900/40"
      onMouseDown={(event) => event.target === event.currentTarget && onClose()}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy}
        tabIndex={-1}
        className="w-[min(440px,calc(100vw-32px))] rounded-xl bg-white p-5 shadow-2xl ring-1 ring-black/5 [&_h2]:mb-2 [&_h2]:text-base [&_h2]:font-semibold"
        onKeyDown={onKeyDown}
      >
        {children}
      </div>
    </div>
  );
}
