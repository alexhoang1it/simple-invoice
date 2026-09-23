import { type ReactElement, type ReactNode } from 'react';
import { render, type RenderOptions } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { vi } from 'vitest';
import { SessionProvider } from '~/auth/SessionProvider';
import { Toasts } from '~/components/Toasts';
import type { Account, Invoice, InvoiceRow } from '~/api/types';

export const TOKEN = 'header.payload.signature';

export const ACCOUNT: Account = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'reviewer@simpleinvoice.dev',
  fullname: 'Ops Reviewer',
};

/**
 * A recorded call plus the reply the stub gave back.
 *
 * `fetch` is stubbed rather than reaching for a service worker: the app talks to
 * five endpoints through one thin module, so intercepting at the global is both
 * enough and considerably quicker to reason about in a failing test.
 */
export interface Call {
  url: URL;
  method: string;
  body: unknown;
  headers: Record<string, string>;
}

export type Route = (call: Call) => { status?: number; body?: unknown } | undefined;

export interface Server {
  calls: Call[];
  /** Calls to a given path, in order. */
  to: (pathname: string) => Call[];
}

/**
 * Installs a fetch stub. Routes are tried in order; the first to answer wins,
 * and an unmatched request fails the test loudly rather than hanging.
 */
export function stubServer(...routes: Route[]): Server {
  const calls: Call[] = [];

  vi.stubGlobal(
    'fetch',
    vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const call: Call = {
        url: new URL(String(input), 'http://localhost'),
        method: init?.method ?? 'GET',
        body: init?.body ? JSON.parse(String(init.body)) : undefined,
        headers: (init?.headers ?? {}) as Record<string, string>,
      };

      calls.push(call);

      for (const route of routes) {
        const reply = route(call);

        if (reply) {
          const status = reply.status ?? 200;

          return new Response(JSON.stringify(reply.body ?? {}), {
            status,
            headers: { 'Content-Type': 'application/json' },
          });
        }
      }

      throw new Error(`No stub for ${call.method} ${call.url.pathname}`);
    }),
  );

  return { calls, to: (pathname) => calls.filter((c) => c.url.pathname === pathname) };
}

/** Route helper: match on method and exact path. */
export const on =
  (
    method: string,
    pathname: string,
    reply: (call: Call) => { status?: number; body?: unknown },
  ): Route =>
  (call) =>
    call.method === method && call.url.pathname === pathname ? reply(call) : undefined;

/** Route helper: match a path pattern with a single `:param` segment. */
export const onPattern =
  (
    method: string,
    pattern: RegExp,
    reply: (call: Call) => { status?: number; body?: unknown },
  ): Route =>
  (call) =>
    call.method === method && pattern.test(call.url.pathname) ? reply(call) : undefined;

/** The /auth/me route, so a signed-in render resolves. */
export const whoAmIRoute: Route = on('GET', '/api/auth/me', () => ({ body: ACCOUNT }));

interface Options extends Omit<RenderOptions, 'wrapper'> {
  route?: string;
  signedIn?: boolean;
}

export function renderApp(ui: ReactElement, options: Options = {}) {
  const { route = '/', signedIn = false, ...rest } = options;

  if (signedIn) {
    window.localStorage.setItem('simpleinvoice.token', TOKEN);
  }

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      // A fresh Map per render keeps the SWR cache from leaking between tests,
      // and deduping off means each test sees the requests it triggered.
      <SWRConfig
        value={{ provider: () => new Map(), dedupingInterval: 0, shouldRetryOnError: false }}
      >
        <MemoryRouter initialEntries={[route]}>
          <SessionProvider>
            <Toasts>{children}</Toasts>
          </SessionProvider>
        </MemoryRouter>
      </SWRConfig>
    );
  }

  return { user: userEvent.setup(), ...render(ui, { wrapper: Wrapper, ...rest }) };
}

// -- fixtures ---------------------------------------------------------------

export function aRow(overrides: Partial<InvoiceRow> = {}): InvoiceRow {
  return {
    invoiceId: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
    invoiceNumber: 'IV1780488206995',
    invoiceReference: '#5721662',
    invoiceDate: '2026-06-03',
    dueDate: '2026-07-03',
    currency: 'AUD',
    currencySymbol: 'AU$',
    totalAmount: 2180,
    balanceAmount: 728.66,
    status: 'Overdue',
    customer: {
      id: 'c1',
      fullname: 'Paul',
      email: 'paul@101digital.io',
      mobileNumber: '947717364111',
      address: 'Singapore',
    },
    ...overrides,
  };
}

export function anInvoice(overrides: Partial<Invoice> = {}): Invoice {
  return {
    ...aRow(),
    description: 'Invoice is issued to Kanglee',
    invoiceSubTotal: 2000,
    taxRate: 10,
    totalTax: 200,
    totalDiscount: 20,
    totalPaid: 1451.34,
    items: [
      {
        id: 'b1c2d3e4-0000-0000-0000-000000000001',
        name: 'Honda RC150',
        quantity: 2,
        rate: 1000,
        amount: 2000,
      },
    ],
    createdBy: ACCOUNT.id,
    createdAt: '2026-06-03T12:03:26.995Z',
    ...overrides,
  };
}

export const pageOf = (rows: InvoiceRow[], total = rows.length, page = 1, pageSize = 10) => ({
  data: rows,
  paging: { page, pageSize, total },
});
