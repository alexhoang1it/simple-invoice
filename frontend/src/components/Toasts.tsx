import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { type Toast, ToastContext, type ToastApi, type ToastTone } from './toast-context';

const LIFETIME_MS = 5000;

/**
 * Transient confirmations. Small enough to keep in-house rather than pulling a
 * dependency for it.
 *
 * The region is a polite live region that exists before anything goes into it —
 * a screen reader only announces insertions into a region that was already
 * present.
 */
export function Toasts({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const drop = useCallback((id: number) => {
    setToasts((current) => current.filter((t) => t.id !== id));

    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const say = useCallback(
    (tone: ToastTone, text: string) => {
      const id = next.current++;

      setToasts((current) => [...current, { id, tone, text }]);
      timers.current.set(
        id,
        setTimeout(() => drop(id), LIFETIME_MS),
      );
    },
    [drop],
  );

  useEffect(() => {
    const pending = timers.current;

    return () => {
      pending.forEach(clearTimeout);
      pending.clear();
    };
  }, []);

  const api = useMemo<ToastApi>(() => ({ say }), [say]);

  return (
    <ToastContext.Provider value={api}>
      {children}

      <div
        role="status"
        aria-live="polite"
        className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(24rem,calc(100vw-2rem))] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={[
              'pointer-events-auto flex items-start gap-3 rounded-sheet border-l-2 bg-paper-raised',
              'px-4 py-3 shadow-lift',
              toast.tone === 'good' ? 'border-l-moss' : 'border-l-claret',
            ].join(' ')}
          >
            <p className="flex-1 text-sm">{toast.text}</p>
            <button
              type="button"
              onClick={() => drop(toast.id)}
              aria-label="Dismiss"
              className="-mr-1 rounded px-1 text-ink-faint hover:text-ink"
            >
              &times;
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
