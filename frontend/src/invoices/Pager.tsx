import type { Paging } from '~/api/types';
import { Button } from '~/components/ui';
import { PAGE_SIZES } from './useFilters';

interface Props {
  paging: Paging;
  busy: boolean;
  onPage: (page: number) => void;
  onPageSize: (size: number) => void;
}

/**
 * Previous/next only. With server-side paging the client knows the total but
 * nothing about the contents of other pages, and numbered links to forty of
 * them are noise; the counts are what tells you where you are.
 */
export function Pager({ paging, busy, onPage, onPageSize }: Props) {
  const { page, pageSize, total } = paging;

  const pages = Math.max(1, Math.ceil(total / pageSize));
  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const last = Math.min(page * pageSize, total);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-3 border-t border-paper-line px-4 py-3"
    >
      <p className="text-xs text-ink-faint" aria-live="polite">
        {total === 0 ? 'Nothing to show' : `${first}–${last} of ${total}`}
      </p>

      <div className="flex items-center gap-2">
        <label className="flex items-center gap-2 text-xs text-ink-faint">
          Rows
          <select
            aria-label="Rows per page"
            value={pageSize}
            disabled={busy}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 cursor-pointer rounded-sheet border border-paper-edge bg-paper-raised px-2 text-xs"
          >
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size}
              </option>
            ))}
          </select>
        </label>

        <Button
          tone="secondary"
          compact
          disabled={busy || page <= 1}
          onClick={() => onPage(page - 1)}
        >
          Previous
        </Button>

        <span className="min-w-[5.5rem] text-center text-xs text-ink-faint">
          Page {page} of {pages}
        </span>

        <Button
          tone="secondary"
          compact
          disabled={busy || page >= pages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </nav>
  );
}
