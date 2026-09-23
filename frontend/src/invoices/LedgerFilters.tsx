import { useEffect, useRef, useState } from 'react';
import { type InvoiceFilters, STATUSES, type Status } from '~/api/types';
import { useDebounced } from '~/lib/useDebounced';
import { Button, SelectField, TextField } from '~/components/ui';

const STATUS_OPTIONS = STATUSES.map((s) => ({ value: s, label: s }));

interface Props {
  filters: InvoiceFilters;
  onChange: (patch: Partial<InvoiceFilters>) => void;
  onClear: () => void;
  narrowed: boolean;
}

export function LedgerFilters({ filters, onChange, onClear, narrowed }: Props) {
  // The box is driven locally while typing; only the settled value goes back
  // into the URL, so typing never stutters.
  const [term, setTerm] = useState(filters.keyword ?? '');
  const settled = useDebounced(term);
  const pushed = useRef(filters.keyword ?? '');

  useEffect(() => {
    if (settled === pushed.current) return;

    pushed.current = settled;
    onChange({ keyword: settled || undefined });
  }, [settled, onChange]);

  // Keeps the box in step when the filters get cleared from elsewhere.
  useEffect(() => {
    const incoming = filters.keyword ?? '';

    if (incoming !== pushed.current) {
      pushed.current = incoming;
      setTerm(incoming);
    }
  }, [filters.keyword]);

  return (
    <div className="grid gap-3 border-b border-paper-line p-4 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))_auto] lg:items-end">
      <div className="sm:col-span-2 lg:col-span-1">
        <label className="sr-only" htmlFor="ledger-search">
          Search by invoice number or customer
        </label>
        <div className="relative">
          <svg
            aria-hidden="true"
            viewBox="0 0 16 16"
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-faint"
          >
            <circle cx="7" cy="7" r="5" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path
              d="M11 11l4 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
            />
          </svg>
          <input
            id="ledger-search"
            type="search"
            autoComplete="off"
            placeholder="Invoice number or customer…"
            value={term}
            onChange={(e) => setTerm(e.target.value)}
            className="field-input pl-9"
          />
        </div>
      </div>

      <SelectField
        label="Status"
        options={STATUS_OPTIONS}
        placeholder="Any status"
        value={filters.status ?? ''}
        onChange={(e) =>
          onChange({ status: (e.target.value || undefined) as Status | undefined })
        }
      />

      <TextField
        label="Issued from"
        type="date"
        max={filters.toDate}
        value={filters.fromDate ?? ''}
        onChange={(e) => onChange({ fromDate: e.target.value || undefined })}
      />

      <TextField
        label="Issued to"
        type="date"
        min={filters.fromDate}
        value={filters.toDate ?? ''}
        onChange={(e) => onChange({ toDate: e.target.value || undefined })}
      />

      <Button
        tone="quiet"
        onClick={onClear}
        disabled={!narrowed}
        className="justify-self-start"
      >
        Reset
      </Button>
    </div>
  );
}
