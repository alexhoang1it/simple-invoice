import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import {
  aRow,
  on,
  pageOf,
  renderApp,
  type Server,
  stubServer,
  whoAmIRoute,
} from '~/test/harness';
import { LedgerPage } from './LedgerPage';

const LIST = '/api/invoices';

/** Always answers the list call, and records the query string it was sent. */
function ledger(body: unknown = pageOf([aRow()])): Server {
  return stubServer(
    whoAmIRoute,
    on('GET', LIST, () => ({ body })),
  );
}

const queries = (server: Server) => server.to(LIST).map((c) => c.url.searchParams);
const sent = (server: Server, key: string) =>
  queries(server).some((params) => params.get(key) !== null);

describe('LedgerPage', () => {
  it('renders a row per invoice with the fields the brief lists', async () => {
    ledger(pageOf([aRow()]));
    renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    const rows = await screen.findAllByTestId('ledger-row');
    expect(rows).toHaveLength(1);

    const row = within(rows[0]!);
    expect(row.getByText('IV1780488206995')).toBeInTheDocument();
    expect(row.getByText('Paul')).toBeInTheDocument();
    expect(row.getByText('3 Jun 2026')).toBeInTheDocument();
    expect(row.getByText('3 Jul 2026')).toBeInTheDocument();
    expect(row.getByText('AU$2,180.00')).toBeInTheDocument();
    expect(row.getByTestId('status-chip')).toHaveTextContent('Overdue');
  });

  it('shows the totals the server reported, not a count of the rows on screen', async () => {
    ledger(pageOf([aRow()], 94, 1, 1));
    renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    expect(await screen.findByText('1–1 of 94')).toBeInTheDocument();
  });

  it('asks the API to search rather than filtering what it already has', async () => {
    const server = ledger();
    const { user } = renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    await screen.findAllByTestId('ledger-row');
    await user.type(screen.getByRole('searchbox'), 'braddon');

    await waitFor(() =>
      expect(queries(server).some((q) => q.get('keyword') === 'braddon')).toBe(true),
    );
  });

  it('debounces typing instead of firing a request per keystroke', async () => {
    const server = ledger();
    const { user } = renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    await screen.findAllByTestId('ledger-row');
    const before = server.to(LIST).length;

    await user.type(screen.getByRole('searchbox'), 'paul');

    await waitFor(() => expect(server.to(LIST).length).toBeGreaterThan(before));
    expect(server.to(LIST).length - before).toBeLessThan(4);
  });

  it('sends the status filter', async () => {
    const server = ledger();
    const { user } = renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    await screen.findAllByTestId('ledger-row');
    await user.selectOptions(screen.getByLabelText('Status'), 'Overdue');

    await waitFor(() =>
      expect(queries(server).some((q) => q.get('status') === 'Overdue')).toBe(true),
    );
  });

  it('asks the server to sort, and flips direction on a second click', async () => {
    const server = ledger();
    const { user } = renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    await screen.findAllByTestId('ledger-row');

    // Re-queried each time: the header is re-rendered between clicks, and a
    // held reference would carry the previous render's handler.
    const totalHeader = () => screen.getByRole('button', { name: /total/i });

    await user.click(totalHeader());
    await waitFor(() =>
      expect(
        queries(server).some(
          (q) => q.get('sortBy') === 'totalAmount' && q.get('ordering') === 'DESC',
        ),
      ).toBe(true),
    );

    await user.click(totalHeader());
    await waitFor(() =>
      expect(
        queries(server).some(
          (q) => q.get('sortBy') === 'totalAmount' && q.get('ordering') === 'ASC',
        ),
      ).toBe(true),
    );
  });

  it('keeps the table mounted while refetching, so sorting by keyboard does not lose focus', async () => {
    // Swapping in the skeleton on every refetch unmounts the header the user is
    // standing on and dumps focus back to the document.
    const server = ledger();
    renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    await screen.findAllByTestId('ledger-row');

    const header = screen.getByRole('button', { name: /total/i });
    header.focus();
    header.click();

    await waitFor(() => expect(server.to(LIST).length).toBeGreaterThan(1));

    expect(screen.getByRole('button', { name: /total/i })).toHaveFocus();
  });

  it('marks the sorted column for assistive technology', async () => {
    ledger();
    renderApp(<LedgerPage />, {
      route: '/invoices?sortBy=dueDate&ordering=ASC',
      signedIn: true,
    });

    await screen.findAllByTestId('ledger-row');

    expect(screen.getByRole('columnheader', { name: /due/i })).toHaveAttribute(
      'aria-sort',
      'ascending',
    );
  });

  it('fetches the next page from the server', async () => {
    const server = stubServer(
      whoAmIRoute,
      on('GET', LIST, (call) => {
        const page = Number(call.url.searchParams.get('page') ?? 1);

        return {
          body: pageOf(
            [aRow({ invoiceId: `p${page}`, invoiceNumber: `PAGE-${page}` })],
            3,
            page,
            1,
          ),
        };
      }),
    );

    const { user } = renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    expect(await screen.findByText('PAGE-1')).toBeInTheDocument();

    await user.click(screen.getByRole('button', { name: /next/i }));

    expect(await screen.findByText('PAGE-2')).toBeInTheDocument();
    expect(screen.getByText('Page 2 of 3')).toBeInTheDocument();
    expect(sent(server, 'page')).toBe(true);
  });

  it('does not put a due countdown on a settled invoice', async () => {
    // A "days late" note beside a PAID chip contradicts itself.
    ledger(pageOf([aRow({ status: 'Paid', dueDate: '2020-01-01', balanceAmount: 0 })]));
    renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    await screen.findAllByTestId('ledger-row');

    expect(screen.queryByText(/days late/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('status-chip')).toHaveTextContent('Paid');
  });

  it('still shows the countdown while an invoice is outstanding', async () => {
    ledger(pageOf([aRow({ status: 'Overdue', dueDate: '2020-01-01' })]));
    renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    await screen.findAllByTestId('ledger-row');

    expect(screen.getByText(/days late/i)).toBeInTheDocument();
  });

  it('disables Previous on the first page', async () => {
    ledger();
    renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    await screen.findAllByTestId('ledger-row');

    expect(screen.getByRole('button', { name: /previous/i })).toBeDisabled();
  });

  it('restores the filters held in the URL', async () => {
    const server = ledger();

    renderApp(<LedgerPage />, {
      route: '/invoices?status=Paid&keyword=paul&sortBy=dueDate&ordering=ASC&page=2',
      signedIn: true,
    });

    await waitFor(() => expect(server.to(LIST).length).toBeGreaterThan(0));

    const params = queries(server)[0]!;
    expect(params.get('status')).toBe('Paid');
    expect(params.get('keyword')).toBe('paul');
    expect(params.get('sortBy')).toBe('dueDate');
    expect(params.get('ordering')).toBe('ASC');
    expect(params.get('page')).toBe('2');
  });

  it('drops a filter value the API would only reject', async () => {
    const server = ledger();

    renderApp(<LedgerPage />, {
      route: '/invoices?status=Nonsense&sortBy=customerName',
      signedIn: true,
    });

    await waitFor(() => expect(server.to(LIST).length).toBeGreaterThan(0));

    const params = queries(server)[0]!;
    expect(params.get('status')).toBeNull();
    expect(params.get('sortBy')).toBe('invoiceDate');
  });

  it('offers to reset the filters when nothing matches', async () => {
    stubServer(
      whoAmIRoute,
      on('GET', LIST, () => ({ body: pageOf([], 0) })),
    );

    renderApp(<LedgerPage />, { route: '/invoices?keyword=zzz', signedIn: true });

    expect(await screen.findByText('Nothing matches those filters')).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /reset/i }).length).toBeGreaterThan(0);
  });

  it('distinguishes an empty ledger from an over-filtered one', async () => {
    stubServer(
      whoAmIRoute,
      on('GET', LIST, () => ({ body: pageOf([], 0) })),
    );

    renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    expect(await screen.findByText('No invoices yet')).toBeInTheDocument();
  });

  it('surfaces a failed request with a way to retry', async () => {
    stubServer(
      whoAmIRoute,
      on('GET', LIST, () => ({
        status: 500,
        body: {
          statusCode: 500,
          message: 'Internal server error',
          error: 'Internal Server Error',
        },
      })),
    );

    renderApp(<LedgerPage />, { route: '/invoices', signedIn: true });

    expect(await screen.findByRole('alert')).toHaveTextContent(/didn’t work/i);
    expect(screen.getByRole('button', { name: /try again/i })).toBeInTheDocument();
  });
});
