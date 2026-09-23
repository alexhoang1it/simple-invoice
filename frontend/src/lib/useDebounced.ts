import { useEffect, useState } from 'react';

/**
 * Holds a rapidly changing value still for a moment.
 *
 * The ledger search box uses it: without one, every keystroke is a request and
 * the responses can arrive out of order. 300ms is short enough to feel instant
 * and long enough to collapse a typed word into a single call.
 */
export function useDebounced<T>(value: T, delayMs = 300): T {
  const [settled, setSettled] = useState(value);

  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delayMs);

    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return settled;
}
