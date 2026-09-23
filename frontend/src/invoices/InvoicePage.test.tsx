import { describe, expect, it } from 'vitest';
import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { anInvoice, onPattern, renderApp, stubServer, whoAmIRoute } from '~/test/harness';
import type { Invoice } from '~/api/types';
import { InvoicePage } from './InvoicePage';

const ID = '099ca7da-a290-40fa-93b9-1c43ae7bb887';
const DETAIL = /^\/api\/invoices\/[\w-]+$/;

/**
 * Renders the detail route with a stubbed reply.
 *
 * The success and failure cases take separate parameters rather than one union:
 * an Invoice has its own `status` field, so sniffing for one would read every
 * successful invoice as an error reply.
 */
function show(invoice: Invoice): ReturnType<typeof renderApp>;
function show(
  invoice: null,
  failure: { status: number; body: unknown },
): ReturnType<typeof renderApp>;
function show(invoice: Invoice | null, failure?: { status: number; body: unknown }) {
  stubServer(
    whoAmIRoute,
    onPattern('GET', DETAIL, () => failure ?? { body: invoice }),
  );

  return renderApp(
    <Routes>
      <Route path="/invoices/:invoiceId" element={<InvoicePage />} />
    </Routes>,
    { route: `/invoices/${ID}`, signedIn: true },
  );
}

describe('InvoicePage', () => {
  it('shows the invoice, the customer and the line', async () => {
    show(anInvoice());

    expect(await screen.findByRole('heading', { name: 'IV1780488206995' })).toBeInTheDocument();

    expect(screen.getByText('3 Jun 2026')).toBeInTheDocument();
    expect(screen.getByText('3 Jul 2026')).toBeInTheDocument();
    expect(screen.getByText('Invoice is issued to Kanglee')).toBeInTheDocument();

    expect(screen.getByText('Paul')).toBeInTheDocument();
    expect(screen.getByText('paul@101digital.io')).toBeInTheDocument();
    expect(screen.getByText('Singapore')).toBeInTheDocument();

    expect(screen.getByText('Honda RC150')).toBeInTheDocument();
  });

  it('shows every monetary figure the brief asks for', async () => {
    show(anInvoice());

    await screen.findByRole('heading', { name: 'IV1780488206995' });

    // The line amount and the subtotal are the same figure on a one-line invoice.
    expect(screen.getAllByText('AU$2,000.00')).toHaveLength(2);
    expect(screen.getByText('AU$200.00')).toBeInTheDocument();
    expect(screen.getByText('-AU$20.00')).toBeInTheDocument();
    expect(screen.getByText('AU$2,180.00')).toBeInTheDocument();
    expect(screen.getByText('AU$1,451.34')).toBeInTheDocument();
    expect(screen.getByTestId('balance')).toHaveTextContent('AU$728.66');
  });

  it('labels the tax row with the rate that was applied', async () => {
    show(anInvoice());

    expect(await screen.findByText('Tax (10%)')).toBeInTheDocument();
  });

  it('shows the derived status the API returned', async () => {
    show(anInvoice());

    expect(await screen.findByTestId('status-chip')).toHaveTextContent('Overdue');
  });

  it('calls a fully paid invoice settled rather than outstanding', async () => {
    show(anInvoice({ status: 'Paid', totalPaid: 2180, balanceAmount: 0 }));

    expect(await screen.findByText('Settled')).toBeInTheDocument();
    expect(screen.queryByText('Outstanding')).not.toBeInTheDocument();
  });

  it('drops the due countdown once an invoice is settled', async () => {
    show(
      anInvoice({ status: 'Paid', dueDate: '2020-01-01', totalPaid: 2180, balanceAmount: 0 }),
    );

    await screen.findByRole('heading', { name: 'IV1780488206995' });

    expect(screen.queryByText(/days late/i)).not.toBeInTheDocument();
  });

  it('keeps the countdown while an invoice is still outstanding', async () => {
    show(anInvoice({ status: 'Overdue', dueDate: '2020-01-01' }));

    await screen.findByRole('heading', { name: 'IV1780488206995' });

    expect(screen.getByText(/days late/i)).toBeInTheDocument();
  });

  it('hides customer rows that have no value rather than showing blanks', async () => {
    show(
      anInvoice({
        customer: {
          id: 'c1',
          fullname: 'Paul',
          email: 'p@x.io',
          mobileNumber: null,
          address: null,
        },
      }),
    );

    await screen.findByRole('heading', { name: 'IV1780488206995' });

    expect(screen.queryByText('Phone')).not.toBeInTheDocument();
    expect(screen.queryByText('Address')).not.toBeInTheDocument();
  });

  it('explains a missing invoice instead of showing a raw error', async () => {
    show(null, {
      status: 404,
      body: { statusCode: 404, message: 'Invoice not found', error: 'Not Found' },
    });

    expect(await screen.findByText('No such invoice')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /back to the ledger/i })).toBeInTheDocument();
  });

  it('offers a retry when the read fails for a reason that might pass', async () => {
    show(null, {
      status: 500,
      body: {
        statusCode: 500,
        message: 'Internal server error',
        error: 'Internal Server Error',
      },
    });

    expect(await screen.findByRole('alert')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
