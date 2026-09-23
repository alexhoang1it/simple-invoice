import { useNavigate } from 'react-router-dom';
import type { InvoiceRow, Ordering, SortField } from '~/api/types';
import { describeDue, formatDate, formatMoney } from '~/lib/format';
import { StatusChip } from '~/components/ui';

interface Props {
  rows: InvoiceRow[];
  sortBy: SortField;
  ordering: Ordering;
  onSort: (field: SortField) => void;
}

const COLUMNS: Array<{ key: string; label: string; sort?: SortField; right?: boolean }> = [
  { key: 'number', label: 'Invoice' },
  { key: 'customer', label: 'Customer' },
  { key: 'issued', label: 'Issued', sort: 'invoiceDate' },
  { key: 'due', label: 'Due', sort: 'dueDate' },
  { key: 'total', label: 'Total', sort: 'totalAmount', right: true },
  { key: 'status', label: 'Status', right: true },
];

export function LedgerTable({ rows, sortBy, ordering, onSort }: Props) {
  const navigate = useNavigate();

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[46rem] border-collapse text-sm">
        <caption className="sr-only">
          Invoices, sorted by {sortBy}, {ordering === 'ASC' ? 'ascending' : 'descending'}
        </caption>

        <thead className="bg-paper-sunk">
          <tr>
            {COLUMNS.map((column) => {
              const active = column.sort === sortBy;

              return (
                <th
                  key={column.key}
                  scope="col"
                  className={`col-head ${column.right ? 'text-right' : ''}`}
                  aria-sort={
                    column.sort
                      ? active
                        ? ordering === 'ASC'
                          ? 'ascending'
                          : 'descending'
                        : 'none'
                      : undefined
                  }
                >
                  {column.sort ? (
                    <button
                      type="button"
                      onClick={() => onSort(column.sort as SortField)}
                      className={`inline-flex items-center gap-1 uppercase tracking-wider transition-colors hover:text-ink ${
                        active ? 'text-claret' : ''
                      }`}
                    >
                      {column.label}
                      <span aria-hidden="true" className="text-[9px]">
                        {active ? (ordering === 'ASC' ? '▲' : '▼') : '↕'}
                      </span>
                    </button>
                  ) : (
                    column.label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>

        <tbody>
          {rows.map((row) => {
            const open = () => navigate(`/invoices/${row.invoiceId}`);
            // A settled invoice has no countdown worth showing — "20 days late"
            // next to a PAID chip just contradicts itself.
            const due = row.status === 'Paid' ? null : describeDue(row.dueDate);
            const late = row.status === 'Overdue';
            const partPaid = row.balanceAmount > 0 && row.balanceAmount !== row.totalAmount;

            return (
              <tr
                key={row.invoiceId}
                data-testid="ledger-row"
                onClick={open}
                className="cursor-pointer border-t border-paper-line transition-colors hover:bg-paper-sunk/70"
              >
                {/* nowrap: an invoice number is one token and reads as nonsense
                    broken over three lines when the table is scrolled narrow. */}
                <td className="whitespace-nowrap px-4 py-3">
                  {/* A real link, so middle-click and keyboard both work; the
                      row click is a convenience on top of it. */}
                  <a
                    href={`/invoices/${row.invoiceId}`}
                    onClick={(e) => {
                      if (e.metaKey || e.ctrlKey || e.shiftKey) return;
                      e.preventDefault();
                      e.stopPropagation();
                      open();
                    }}
                    className="font-mono text-xs font-medium text-claret hover:underline"
                  >
                    {row.invoiceNumber}
                  </a>
                </td>

                <td className="px-4 py-3">
                  <span className="block truncate font-medium">{row.customer.fullname}</span>
                  <span className="block truncate text-xs text-ink-faint">
                    {row.customer.email}
                  </span>
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-ink-soft">
                  {formatDate(row.invoiceDate)}
                </td>

                <td className="whitespace-nowrap px-4 py-3">
                  <span className="text-ink-soft">{formatDate(row.dueDate)}</span>
                  {due && (
                    <span
                      className={`block text-xs ${late ? 'text-claret' : 'text-ink-faint'}`}
                    >
                      {due}
                    </span>
                  )}
                </td>

                <td className="whitespace-nowrap px-4 py-3 text-right font-medium">
                  {formatMoney(row.totalAmount, row.currencySymbol, row.currency)}
                  {partPaid && (
                    <span className="block text-xs font-normal text-ink-faint">
                      {formatMoney(row.balanceAmount, row.currencySymbol, row.currency)} owing
                    </span>
                  )}
                </td>

                <td className="px-4 py-3 text-right">
                  <StatusChip status={row.status} />
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
