import { type FormEvent, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useSWRConfig } from 'swr';
import { raiseInvoice } from '~/api/endpoints';
import type { NewInvoice } from '~/api/types';
import { ApiError } from '~/lib/http';
import { formatMoney, isoPlusDays, todayIso } from '~/lib/format';
import {
  amountInRange,
  email as emailRule,
  isClean,
  isoDate,
  maxLength,
  notBefore,
  positiveAmount,
  required,
  validate,
  wholeNumber,
} from '~/lib/validate';
import { Button, SelectField, TextField } from '~/components/ui';
import { useToasts } from '~/components/toast-context';

const CURRENCIES = [
  { value: 'AUD', label: 'AUD — Australian Dollar', symbol: 'AU$' },
  { value: 'NZD', label: 'NZD — New Zealand Dollar', symbol: 'NZ$' },
  { value: 'SGD', label: 'SGD — Singapore Dollar', symbol: 'S$' },
  { value: 'GBP', label: 'GBP — Pound Sterling', symbol: '£' },
  { value: 'USD', label: 'USD — US Dollar', symbol: 'US$' },
  { value: 'EUR', label: 'EUR — Euro', symbol: '€' },
];

const TERM_DAYS = 30;

type Field =
  | 'invoiceNumber'
  | 'reference'
  | 'invoiceDate'
  | 'dueDate'
  | 'currency'
  | 'description'
  | 'customerName'
  | 'customerEmail'
  | 'customerPhone'
  | 'customerAddress'
  | 'lineName'
  | 'quantity'
  | 'rate'
  | 'taxRate'
  | 'discount';

const BLANK: Record<Field, string> = {
  invoiceNumber: '',
  reference: '',
  invoiceDate: todayIso(),
  dueDate: isoPlusDays(TERM_DAYS),
  currency: 'AUD',
  description: '',
  customerName: '',
  customerEmail: '',
  customerPhone: '',
  customerAddress: '',
  lineName: '',
  quantity: '1',
  rate: '',
  taxRate: '10',
  discount: '0',
};

export function NewInvoicePage() {
  const navigate = useNavigate();
  const { mutate } = useSWRConfig();
  const { say } = useToasts();

  const [values, setValues] = useState(BLANK);
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [rejections, setRejections] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const set = (field: Field) => (e: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: e.target.value }));
  };

  const symbol = CURRENCIES.find((c) => c.value === values.currency)?.symbol ?? '';

  // A preview of what the server will work out. Only ever cosmetic: the stored
  // figures are whatever the API returns.
  const preview = useMemo(() => estimate(values), [values]);

  function runChecks() {
    return validate<Field>(values, {
      invoiceNumber: [required('Invoice number'), maxLength('Invoice number', 64)],
      reference: [maxLength('Reference', 64)],
      invoiceDate: [isoDate('Invoice date')],
      dueDate: [isoDate('Due date'), notBefore('Due date', values.invoiceDate, 'invoice date')],
      currency: [required('Currency')],
      description: [maxLength('Note', 1000)],
      customerName: [required('Customer name'), maxLength('Customer name', 160)],
      customerEmail: [required('Customer email'), emailRule('Customer email')],
      customerPhone: [maxLength('Phone', 32)],
      customerAddress: [maxLength('Address', 512)],
      lineName: [required('Description'), maxLength('Description', 255)],
      quantity: [wholeNumber('Quantity')],
      rate: [positiveAmount('Rate')],
      taxRate: [amountInRange('Tax', 0, 100)],
      discount: [amountInRange('Discount', 0, 99_999_999)],
    });
  }

  async function submit(event: FormEvent) {
    event.preventDefault();
    setRejections([]);

    const found = runChecks();
    setErrors(found);

    if (!isClean(found)) {
      // Put the caret on the first thing that needs attention.
      document.getElementById(`field-${Object.keys(found)[0]}`)?.focus();
      return;
    }

    setBusy(true);

    try {
      const created = await raiseInvoice(toPayload(values));

      // Every cached page is stale now: the new invoice could belong on any of
      // them depending on the filters in play.
      await mutate((key) => Array.isArray(key) && key[0] === 'invoices', undefined, {
        revalidate: true,
      });

      say('good', `${created.invoiceNumber} raised as a draft.`);
      navigate('/invoices');
    } catch (error) {
      if (error instanceof ApiError && error.isConflict) {
        // Only the server can know this, so its verdict goes on the field.
        setErrors({ invoiceNumber: error.messages.join(' ') });
        document.getElementById('field-invoiceNumber')?.focus();
        return;
      }

      setRejections(
        error instanceof ApiError ? error.messages : ['The invoice could not be raised.'],
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Link
        to="/invoices"
        className="mb-5 inline-flex items-center gap-1.5 text-sm text-ink-soft hover:text-claret"
      >
        <span aria-hidden="true">&larr;</span> Ledger
      </Link>

      <h1 className="text-2xl">New invoice</h1>
      <p className="mb-6 mt-1 text-sm text-ink-soft">
        Saved as a <strong className="font-medium">draft</strong>. The server works out every
        total when it is raised.
      </p>

      {rejections.length > 0 && (
        <div
          role="alert"
          className="mb-5 rounded-sheet border border-claret/40 bg-claret-wash px-4 py-3 text-sm text-claret"
        >
          <p className="font-medium">The invoice could not be raised</p>
          <ul className="mt-1 list-disc pl-5">
            {rejections.map((message) => (
              <li key={message}>{message}</li>
            ))}
          </ul>
        </div>
      )}

      <form onSubmit={submit} noValidate>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
          <div className="flex flex-col gap-4">
            {/*
              Sections rather than fieldsets. A fieldset carries a UA
              `min-inline-size: min-content`, which stops a grid inside it from
              shrinking and collapses every input to its minimum width.
            */}
            <section className="sheet p-5" aria-labelledby="group-invoice">
              <h2 id="group-invoice" className="field-label">
                Invoice
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="field-invoiceNumber"
                  label="Invoice number"
                  placeholder="SI-2026-0148"
                  autoComplete="off"
                  value={values.invoiceNumber}
                  onChange={set('invoiceNumber')}
                  error={errors.invoiceNumber}
                />
                <TextField
                  id="field-reference"
                  label="Reference"
                  optional
                  placeholder="PO-77431"
                  autoComplete="off"
                  value={values.reference}
                  onChange={set('reference')}
                  error={errors.reference}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-3">
                <TextField
                  id="field-invoiceDate"
                  label="Issue date"
                  type="date"
                  value={values.invoiceDate}
                  onChange={set('invoiceDate')}
                  error={errors.invoiceDate}
                />
                <TextField
                  id="field-dueDate"
                  label="Due date"
                  type="date"
                  value={values.dueDate}
                  onChange={set('dueDate')}
                  error={errors.dueDate}
                />
                <SelectField
                  id="field-currency"
                  label="Currency"
                  options={CURRENCIES}
                  value={values.currency}
                  onChange={set('currency')}
                  error={errors.currency}
                />
              </div>

              <div className="mt-4">
                <TextField
                  id="field-description"
                  label="Note"
                  optional
                  placeholder="What is this invoice for?"
                  value={values.description}
                  onChange={set('description')}
                  error={errors.description}
                />
              </div>
            </section>

            <section className="sheet p-5" aria-labelledby="group-customer">
              <h2 id="group-customer" className="field-label">
                Customer
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  id="field-customerName"
                  label="Name"
                  autoComplete="off"
                  value={values.customerName}
                  onChange={set('customerName')}
                  error={errors.customerName}
                />
                <TextField
                  id="field-customerEmail"
                  label="Email"
                  type="email"
                  autoComplete="off"
                  hint="Invoices to the same address share a customer record"
                  value={values.customerEmail}
                  onChange={set('customerEmail')}
                  error={errors.customerEmail}
                />
                <TextField
                  id="field-customerPhone"
                  label="Phone"
                  optional
                  type="tel"
                  autoComplete="off"
                  value={values.customerPhone}
                  onChange={set('customerPhone')}
                  error={errors.customerPhone}
                />
                <TextField
                  id="field-customerAddress"
                  label="Address"
                  optional
                  autoComplete="off"
                  value={values.customerAddress}
                  onChange={set('customerAddress')}
                  error={errors.customerAddress}
                />
              </div>
            </section>

            <section className="sheet p-5" aria-labelledby="group-line">
              <h2 id="group-line" className="field-label">
                Line
              </h2>

              <div className="grid gap-4 sm:grid-cols-[2fr_1fr_1fr]">
                <TextField
                  id="field-lineName"
                  label="Description"
                  autoComplete="off"
                  value={values.lineName}
                  onChange={set('lineName')}
                  error={errors.lineName}
                />
                <TextField
                  id="field-quantity"
                  label="Quantity"
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={values.quantity}
                  onChange={set('quantity')}
                  error={errors.quantity}
                />
                <TextField
                  id="field-rate"
                  label="Rate"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  prefix={symbol}
                  value={values.rate}
                  onChange={set('rate')}
                  error={errors.rate}
                />
              </div>

              <div className="mt-4 grid gap-4 sm:grid-cols-2">
                <TextField
                  id="field-taxRate"
                  label="Tax %"
                  type="number"
                  min={0}
                  max={100}
                  step="0.01"
                  inputMode="decimal"
                  hint="10% unless you change it"
                  value={values.taxRate}
                  onChange={set('taxRate')}
                  error={errors.taxRate}
                />
                <TextField
                  id="field-discount"
                  label="Discount"
                  type="number"
                  min={0}
                  step="0.01"
                  inputMode="decimal"
                  prefix={symbol}
                  hint="Taken off after tax"
                  value={values.discount}
                  onChange={set('discount')}
                  error={errors.discount}
                />
              </div>
            </section>
          </div>

          <aside className="sheet p-5 lg:sticky lg:top-6" aria-labelledby="preview-heading">
            <h2 id="preview-heading" className="field-label">
              Preview
            </h2>

            <dl className="text-sm">
              <Line
                label="Subtotal"
                value={formatMoney(preview.subTotal, symbol, values.currency)}
                testId="preview-subtotal"
              />
              <Line label="Tax" value={formatMoney(preview.tax, symbol, values.currency)} />
              <Line
                label="Discount"
                value={`${preview.discount > 0 ? '-' : ''}${formatMoney(preview.discount, symbol, values.currency)}`}
              />

              <div className="my-2 border-t border-paper-line" />

              <Line
                label="Total"
                value={formatMoney(preview.total, symbol, values.currency)}
                strong
                testId="preview-total"
              />
            </dl>

            <p className="mt-4 border-t border-dashed border-paper-edge pt-3 text-2xs leading-relaxed text-ink-faint">
              An estimate for your benefit. The invoice is stored with the totals the API
              calculates.
            </p>
          </aside>
        </div>

        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button tone="secondary" onClick={() => navigate('/invoices')}>
            Cancel
          </Button>
          <Button type="submit" busy={busy}>
            {busy ? 'Raising…' : 'Raise invoice'}
          </Button>
        </div>
      </form>
    </>
  );
}

function Line({
  label,
  value,
  strong,
  testId,
}: {
  label: string;
  value: string;
  strong?: boolean;
  testId?: string;
}) {
  return (
    <div
      className={`flex items-baseline justify-between py-1 ${strong ? 'text-base font-semibold' : ''}`}
    >
      <dt className={strong ? '' : 'text-ink-soft'}>{label}</dt>
      <dd className="m-0" data-testid={testId}>
        {value}
      </dd>
    </div>
  );
}

/** Mirrors the server's arithmetic closely enough for a preview. */
function estimate(values: Record<Field, string>) {
  const quantity = toNumber(values.quantity);
  const rate = toNumber(values.rate);
  const taxRate = toNumber(values.taxRate);
  const discount = toNumber(values.discount);

  const subTotal = round(quantity * rate);
  const tax = round(subTotal * (taxRate / 100));

  return { subTotal, tax, discount, total: Math.max(0, round(subTotal + tax - discount)) };
}

function toNumber(value: string): number {
  const parsed = Number(value.trim());

  return Number.isFinite(parsed) ? parsed : 0;
}

function round(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

function toPayload(values: Record<Field, string>): NewInvoice {
  const optional = (value: string) => (value.trim() === '' ? undefined : value.trim());

  return {
    invoiceNumber: values.invoiceNumber.trim(),
    reference: optional(values.reference),
    invoiceDate: values.invoiceDate,
    dueDate: values.dueDate,
    currency: values.currency.toUpperCase(),
    description: optional(values.description),
    customer: {
      fullname: values.customerName.trim(),
      email: values.customerEmail.trim(),
      mobileNumber: optional(values.customerPhone),
      address: optional(values.customerAddress),
    },
    lines: [
      {
        name: values.lineName.trim(),
        quantity: Number(values.quantity),
        rate: Number(values.rate),
      },
    ],
    taxRate: Number(values.taxRate),
    discount: Number(values.discount),
  };
}
