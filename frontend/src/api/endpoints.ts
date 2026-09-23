import { api } from '~/lib/http';
import type {
  Account,
  Invoice,
  InvoiceFilters,
  InvoiceRow,
  NewInvoice,
  Paged,
  Session,
} from './types';

export const signIn = (email: string, password: string): Promise<Session> =>
  api<Session>('/auth/login', { method: 'POST', body: { email, password } });

export const whoAmI = (signal?: AbortSignal): Promise<Account> =>
  api<Account>('/auth/me', { signal });

export const listInvoices = (filters: InvoiceFilters): Promise<Paged<InvoiceRow>> =>
  api<Paged<InvoiceRow>>('/invoices', { query: filters });

export const readInvoice = (id: string): Promise<Invoice> => api<Invoice>(`/invoices/${id}`);

export const raiseInvoice = (body: NewInvoice): Promise<Invoice> =>
  api<Invoice>('/invoices', { method: 'POST', body });

/**
 * SWR cache keys.
 *
 * Kept together so the key a mutation invalidates cannot drift from the key a
 * hook reads under. The list key carries the whole filter object, so changing
 * any filter is a different entry and going back to a previous combination is
 * served from cache.
 */
export const cacheKey = {
  invoices: (filters: InvoiceFilters) => ['invoices', filters] as const,
  invoice: (id: string) => ['invoice', id] as const,
};
