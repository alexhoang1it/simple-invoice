import { useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  type InvoiceFilters,
  type Ordering,
  SORT_FIELDS,
  type SortField,
  STATUSES,
} from '~/api/types';

export const DEFAULT_SORT: SortField = 'invoiceDate';
export const DEFAULT_ORDER: Ordering = 'DESC';
export const PAGE_SIZES = [10, 25, 50] as const;

/**
 * Filter state lives in the query string rather than in component state.
 *
 * That makes a filtered ledger shareable and bookmarkable, survives a reload,
 * and gives the back button the behaviour people expect after changing a
 * filter. It also means the SWR cache key falls out of the URL, so returning to
 * a previous combination renders straight from cache.
 *
 * Values are checked on the way out: a hand-edited `?status=Nonsense` falls back
 * to the default instead of being forwarded for the API to reject.
 */
export function useFilters() {
  const [params, setParams] = useSearchParams();

  const filters = useMemo<InvoiceFilters>(
    () => ({
      page: positive(params.get('page'), 1),
      pageSize: positive(params.get('pageSize'), PAGE_SIZES[0]),
      sortBy: oneOf(params.get('sortBy'), SORT_FIELDS) ?? DEFAULT_SORT,
      ordering: params.get('ordering') === 'ASC' ? 'ASC' : DEFAULT_ORDER,
      status: oneOf(params.get('status'), STATUSES),
      keyword: params.get('keyword') || undefined,
      fromDate: dateOrNothing(params.get('fromDate')),
      toDate: dateOrNothing(params.get('toDate')),
    }),
    [params],
  );

  /**
   * Applies a patch. Anything other than paging itself resets to page one —
   * staying on page 4 of a narrower result set is the classic way to land on an
   * empty screen and think the filter is broken.
   */
  const patch = useCallback(
    (changes: Partial<InvoiceFilters>) => {
      setParams(
        (current) => {
          const next = new URLSearchParams(current);

          for (const [key, value] of Object.entries(changes)) {
            if (value === undefined || value === '' || value === null) next.delete(key);
            else next.set(key, String(value));
          }

          if (!('page' in changes)) next.delete('page');

          return next;
        },
        { replace: true },
      );
    },
    [setParams],
  );

  const clear = useCallback(
    () => setParams(new URLSearchParams(), { replace: true }),
    [setParams],
  );

  /** Same column twice flips the direction. */
  const sortOn = useCallback(
    (field: SortField) => {
      const ordering: Ordering =
        filters.sortBy === field && filters.ordering === 'DESC' ? 'ASC' : 'DESC';

      patch({ sortBy: field, ordering });
    },
    [filters.sortBy, filters.ordering, patch],
  );

  const narrowed = Boolean(
    filters.keyword || filters.status || filters.fromDate || filters.toDate,
  );

  return { filters, patch, clear, sortOn, narrowed };
}

function positive(raw: string | null, fallback: number): number {
  const parsed = Number(raw);

  return Number.isInteger(parsed) && parsed > 0 ? parsed : fallback;
}

function oneOf<T extends string>(raw: string | null, allowed: readonly T[]): T | undefined {
  return allowed.includes(raw as T) ? (raw as T) : undefined;
}

function dateOrNothing(raw: string | null): string | undefined {
  return raw && /^\d{4}-\d{2}-\d{2}$/.test(raw) ? raw : undefined;
}
