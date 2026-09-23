import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { anInvoice, on, renderApp, type Server, stubServer, whoAmIRoute } from '~/test/harness';
import type { NewInvoice } from '~/api/types';
import { NewInvoicePage } from './NewInvoicePage';

const CREATE = '/api/invoices';

const created = on('POST', CREATE, (call) => ({
  status: 201,
  body: anInvoice({ invoiceNumber: (call.body as NewInvoice).invoiceNumber, status: 'Draft' }),
}));

function open(
  ...routes: Parameters<typeof stubServer>
): { server: Server } & ReturnType<typeof renderApp> {
  const server = stubServer(whoAmIRoute, ...(routes.length ? routes : [created]));

  return {
    server,
    ...renderApp(<NewInvoicePage />, { route: '/invoices/new', signedIn: true }),
  };
}

/** Fills in the minimum a valid invoice needs. */
async function fill(user: ReturnType<typeof renderApp>['user']) {
  await user.type(screen.getByLabelText('Invoice number'), 'SI-2026-0148');
  await user.type(screen.getByLabelText('Name'), 'Braddon Freight Co');
  await user.type(screen.getByLabelText('Email'), 'ap@braddonfreight.com.au');
  await user.type(screen.getByLabelText('Description'), 'Freight forwarding');

  const quantity = screen.getByLabelText('Quantity');
  await user.clear(quantity);
  await user.type(quantity, '2');

  await user.type(screen.getByLabelText('Rate'), '1000');
}

const submit = (user: ReturnType<typeof renderApp>['user']) =>
  user.click(screen.getByRole('button', { name: /raise invoice/i }));

describe('NewInvoicePage', () => {
  it('starts with today and thirty-day terms', () => {
    open();

    const today = new Date().toISOString().slice(0, 10);

    expect(screen.getByLabelText('Issue date')).toHaveValue(today);
    expect(screen.getByLabelText('Due date')).not.toHaveValue('');
  });

  it('starts with the 10% tax and zero discount the brief specifies', () => {
    open();

    expect(screen.getByLabelText('Tax %')).toHaveValue(10);
    expect(screen.getByLabelText('Discount')).toHaveValue(0);
  });

  it('names every field that is missing, without calling the API', async () => {
    const { server, user } = open();

    await submit(user);

    expect(await screen.findByText('Invoice number is required')).toBeInTheDocument();
    expect(screen.getByText('Customer name is required')).toBeInTheDocument();
    expect(screen.getByText('Customer email is required')).toBeInTheDocument();
    expect(screen.getByText('Description is required')).toBeInTheDocument();
    expect(screen.getByText('Rate is required')).toBeInTheDocument();

    expect(server.to(CREATE)).toHaveLength(0);
  });

  it('refuses a due date before the issue date', async () => {
    const { user } = open();

    await fill(user);

    const issue = screen.getByLabelText('Issue date');
    const due = screen.getByLabelText('Due date');

    await user.clear(issue);
    await user.type(issue, '2026-06-10');
    await user.clear(due);
    await user.type(due, '2026-06-09');

    await submit(user);

    expect(
      await screen.findByText('Due date cannot be before the invoice date'),
    ).toBeInTheDocument();
  });

  it.each([
    ['Quantity', '1.5', 'Quantity must be a whole number'],
    ['Quantity', '0', 'Quantity must be at least 1'],
    ['Rate', '-10', 'Rate must be more than zero'],
    ['Tax %', '150', 'Tax must be between 0 and 100'],
  ])('refuses %s of %s', async (label, value, message) => {
    const { user } = open();

    await fill(user);

    const field = screen.getByLabelText(label);
    await user.clear(field);
    await user.type(field, value);

    await submit(user);

    expect(await screen.findByText(message)).toBeInTheDocument();
  });

  it('previews the totals as the line is filled in', async () => {
    const { user } = open();

    await fill(user);

    await waitFor(() => {
      expect(screen.getByTestId('preview-subtotal')).toHaveTextContent('AU$2,000.00');
      expect(screen.getByTestId('preview-total')).toHaveTextContent('AU$2,200.00');
    });
  });

  it('posts the nested payload the API expects', async () => {
    const { server, user } = open();

    await fill(user);
    await submit(user);

    await waitFor(() => expect(server.to(CREATE)).toHaveLength(1));

    expect(server.to(CREATE)[0]!.body).toMatchObject({
      invoiceNumber: 'SI-2026-0148',
      currency: 'AUD',
      customer: { fullname: 'Braddon Freight Co', email: 'ap@braddonfreight.com.au' },
      lines: [{ name: 'Freight forwarding', quantity: 2, rate: 1000 }],
      taxRate: 10,
      discount: 0,
    });
  });

  it('never sends a total or a status — the server owns those', async () => {
    const { server, user } = open();

    await fill(user);
    await submit(user);

    await waitFor(() => expect(server.to(CREATE)).toHaveLength(1));

    const body = server.to(CREATE)[0]!.body as Record<string, unknown>;

    for (const field of [
      'totalAmount',
      'invoiceSubTotal',
      'balanceAmount',
      'status',
      'totalPaid',
    ]) {
      expect(body).not.toHaveProperty(field);
    }
  });

  it('leaves optional fields out of the payload rather than sending empty strings', async () => {
    const { server, user } = open();

    await fill(user);
    await submit(user);

    await waitFor(() => expect(server.to(CREATE)).toHaveLength(1));

    const body = server.to(CREATE)[0]!.body as Record<string, unknown>;

    expect(body.reference).toBeUndefined();
    expect((body.customer as Record<string, unknown>).address).toBeUndefined();
  });

  it('confirms with a notification once the invoice is raised', async () => {
    const { user } = open();

    await fill(user);
    await submit(user);

    expect(await screen.findByRole('status')).toHaveTextContent(
      /SI-2026-0148 raised as a draft/i,
    );
  });

  it('puts a duplicate invoice number on the field that caused it', async () => {
    const { user } = open(
      on('POST', CREATE, () => ({
        status: 409,
        body: {
          statusCode: 409,
          message: 'Invoice number SI-2026-0148 is already in use',
          error: 'Conflict',
        },
      })),
    );

    await fill(user);
    await submit(user);

    expect(
      await screen.findByText('Invoice number SI-2026-0148 is already in use'),
    ).toBeInTheDocument();
    expect(screen.getByLabelText('Invoice number')).toHaveAttribute('aria-invalid', 'true');
  });

  it('lists the server’s validation messages when it rejects the payload', async () => {
    const { user } = open(
      on('POST', CREATE, () => ({
        status: 400,
        body: {
          statusCode: 400,
          message: ['dueDate must be on or after invoiceDate'],
          error: 'Bad Request',
        },
      })),
    );

    await fill(user);
    await submit(user);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'dueDate must be on or after invoiceDate',
    );
  });
});
