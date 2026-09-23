import { Link, useNavigate, useParams } from 'react-router-dom';
import useSWR from 'swr';
import { cacheKey, readInvoice } from '~/api/endpoints';
import type { Invoice } from '~/api/types';
import { ApiError } from '~/lib/http';
import { describeDue, formatDate, formatMoney, formatTimestamp } from '~/lib/format';
import { Blank, Button, Failed, Spinner, StatusChip } from '~/components/ui';

export function InvoicePage() {
  const { invoiceId = '' } = useParams<{ invoiceId: string }>();
  const navigate = useNavigate();

  const { data, error, isLoading, mutate } = useSWR<Invoice>(
    invoiceId ? cacheKey.invoice(invoiceId) : null,
    () => readInvoice(invoiceId),
    // A 404 will not turn into a 200 on retry; only retry transient problems.
    { shouldRetryOnError: (e: unknown) => !(e instanceof ApiError && e.isNotFound) },
  );

  if (isLoading) return <Spinner label="Loading invoice" />;

  if (error) {
    return error instanceof ApiError && error.isNotFound ? (
      <Blank
        title="No such invoice"
        detail="It may have been removed, or the link may be wrong."
        action={<Button onClick={() => navigate('/invoices')}>Back to the ledger</Button>}
      />
    ) : (
      <Failed error={error} onRetry={() => void mutate()} />
    );
  }

  if (!data) return null;

  const cash = (amount: number) => formatMoney(amount, data.currencySymbol, data.currency);
  const settled = data.balanceAmount <= 0;

  return (
    <>
      <Link
        to="/invoices"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-claret"
      >
        <span aria-hidden="true">&larr;</span> Ledger
      </Link>

      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">
            {data.invoiceNumber}
          </h1>
          {data.invoiceReference && (
            <p className="mt-1 text-sm text-ink-faint">Reference {data.invoiceReference}</p>
          )}
        </div>

        <div className="flex flex-col items-start gap-1.5 sm:items-end">
          <StatusChip status={data.status} />
          {/* Nothing is pending on a settled invoice, so the countdown goes. */}
          {data.status !== 'Paid' && (
            <span className="text-xs text-ink-faint">{describeDue(data.dueDate)}</span>
          )}
        </div>
      </header>

      <div className="mb-4 grid gap-4 md:grid-cols-2">
        <section className="sheet p-5" aria-labelledby="terms-heading">
          <h2 id="terms-heading" className="field-label">
            Terms
          </h2>
          <Rows
            entries={[
              ['Issued', formatDate(data.invoiceDate)],
              ['Due', formatDate(data.dueDate)],
              ['Currency', `${data.currency} (${data.currencySymbol})`],
              ...(data.description ? [['Note', data.description] as [string, string]] : []),
            ]}
          />
        </section>

        <section className="sheet p-5" aria-labelledby="billed-heading">
          <h2 id="billed-heading" className="field-label">
            Billed to
          </h2>
          <Rows
            entries={[
              ['Name', data.customer.fullname],
              [
                'Email',
                <a
                  key="e"
                  href={`mailto:${data.customer.email}`}
                  className="text-claret hover:underline"
                >
                  {data.customer.email}
                </a>,
              ],
              ...(data.customer.mobileNumber
                ? [['Phone', data.customer.mobileNumber] as [string, string]]
                : []),
              ...(data.customer.address
                ? [['Address', data.customer.address] as [string, string]]
                : []),
            ]}
          />
        </section>
      </div>

      <section className="sheet p-5" aria-labelledby="lines-heading">
        <h2 id="lines-heading" className="field-label">
          Lines
        </h2>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-paper-line">
              <th scope="col" className="col-head pl-0">
                Description
              </th>
              <th scope="col" className="col-head text-right">
                Qty
              </th>
              <th scope="col" className="col-head text-right">
                Rate
              </th>
              <th scope="col" className="col-head pr-0 text-right">
                Amount
              </th>
            </tr>
          </thead>
          <tbody>
            {data.items.map((item) => (
              <tr key={item.id} className="border-b border-paper-line last:border-0">
                <td className="py-3 pl-0 pr-4">{item.name}</td>
                <td className="py-3 pr-4 text-right">{item.quantity}</td>
                <td className="py-3 pr-4 text-right">{cash(item.rate)}</td>
                <td className="py-3 pl-4 pr-0 text-right">{cash(item.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-5 flex justify-end">
          <dl className="w-full max-w-xs text-sm">
            <Total label="Subtotal" value={cash(data.invoiceSubTotal)} />
            <Total label={`Tax (${data.taxRate}%)`} value={cash(data.totalTax)} />
            <Total
              label="Discount"
              value={data.totalDiscount > 0 ? `-${cash(data.totalDiscount)}` : cash(0)}
            />

            <div className="my-2 border-t border-paper-line" />

            <Total label="Total" value={cash(data.totalAmount)} strong />
            <Total label="Paid" value={cash(data.totalPaid)} />
            <Total
              label={settled ? 'Settled' : 'Outstanding'}
              value={cash(data.balanceAmount)}
              tone={settled ? 'moss' : 'claret'}
              strong
              testId="balance"
            />
          </dl>
        </div>

        <p className="mt-5 text-2xs text-ink-faint">Raised {formatTimestamp(data.createdAt)}</p>
      </section>
    </>
  );
}

function Rows({ entries }: { entries: Array<[string, React.ReactNode]> }) {
  return (
    <dl className="grid grid-cols-[auto_1fr] gap-x-6 gap-y-2.5 text-sm">
      {entries.map(([term, value]) => (
        <div key={term} className="contents">
          <dt className="text-ink-faint">{term}</dt>
          <dd className="m-0 break-words">{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function Total({
  label,
  value,
  strong,
  tone,
  testId,
}: {
  label: string;
  value: string;
  strong?: boolean;
  tone?: 'moss' | 'claret';
  testId?: string;
}) {
  const colour = tone === 'moss' ? 'text-moss' : tone === 'claret' ? 'text-claret' : '';

  return (
    <div
      className={`flex items-baseline justify-between py-1 ${strong ? 'font-semibold' : ''}`}
    >
      <dt className={colour || 'text-ink-soft'}>{label}</dt>
      <dd className={`m-0 ${colour}`} data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}
