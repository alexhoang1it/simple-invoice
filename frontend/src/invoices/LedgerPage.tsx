import { useNavigate } from 'react-router-dom';
import useSWR from 'swr';
import { cacheKey, listInvoices } from '~/api/endpoints';
import type { InvoiceRow, Paged } from '~/api/types';
import { Blank, Button, Failed, SkeletonRows } from '~/components/ui';
import { LedgerFilters } from './LedgerFilters';
import { LedgerTable } from './LedgerTable';
import { Pager } from './Pager';
import { useFilters } from './useFilters';

/**
 * The landing screen.
 *
 * Every list operation — search, status, date range, sort, paging — happens in
 * the API. Nothing is re-sorted or re-filtered here, so the counts on screen are
 * the counts in the database rather than the counts in the current page.
 */
export function LedgerPage() {
  const navigate = useNavigate();
  const { filters, patch, clear, sortOn, narrowed } = useFilters();

  const { data, error, isLoading, isValidating, mutate } = useSWR<Paged<InvoiceRow>>(
    cacheKey.invoices(filters),
    () => listInvoices(filters),
    // Holds the previous page on screen while the next one loads, instead of
    // flashing empty on every filter change.
    { keepPreviousData: true, revalidateOnFocus: false },
  );

  const rows = data?.data ?? [];

  return (
    <>
      <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl">Ledger</h1>
          <p className="mt-1 text-sm text-ink-soft">
            Every invoice raised, and what is still owed.
          </p>
        </div>

        <Button onClick={() => navigate('/invoices/new')}>New invoice</Button>
      </header>

      <section className="sheet overflow-hidden">
        <LedgerFilters filters={filters} onChange={patch} onClear={clear} narrowed={narrowed} />

        {/*
          Branch on `data`, not on `isLoading`. Swapping to the skeleton on every
          refetch would unmount the table, which throws away the sort button a
          keyboard user is standing on. Once there is data the table stays
          mounted and only dims while the next page arrives.
        */}
        {!data ? (
          isLoading ? (
            <table className="w-full">
              <SkeletonRows />
            </table>
          ) : (
            <Failed error={error} onRetry={() => void mutate()} />
          )
        ) : rows.length === 0 ? (
          <Blank
            title={narrowed ? 'Nothing matches those filters' : 'No invoices yet'}
            detail={
              narrowed
                ? 'Try a different search term, or widen the status and date filters.'
                : 'Raise your first invoice and it will appear here.'
            }
            action={
              narrowed ? (
                <Button tone="secondary" compact onClick={clear}>
                  Reset filters
                </Button>
              ) : (
                <Button compact onClick={() => navigate('/invoices/new')}>
                  New invoice
                </Button>
              )
            }
          />
        ) : (
          <>
            {/* Dimmed, not disabled: blocking pointer events here would also
                block the sort headers mid-refetch. */}
            <div
              className={isValidating ? 'opacity-60 transition-opacity' : 'transition-opacity'}
            >
              <LedgerTable
                rows={rows}
                sortBy={filters.sortBy ?? 'invoiceDate'}
                ordering={filters.ordering ?? 'DESC'}
                onSort={sortOn}
              />
            </div>

            <Pager
              paging={data.paging}
              busy={isValidating}
              onPage={(page) => patch({ page })}
              onPageSize={(pageSize) => patch({ pageSize })}
            />
          </>
        )}
      </section>
    </>
  );
}
