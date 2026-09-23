// Wire types, written by hand.
//
// Five endpoints does not justify a codegen step; the OpenAPI document at
// /api/docs stays the contract of record and these mirror it. Names match the
// API exactly so a mismatch is obvious reading either side.

export const STATUSES = ['Draft', 'Pending', 'Paid', 'Overdue'] as const;
export type Status = (typeof STATUSES)[number];

export const SORT_FIELDS = ['invoiceDate', 'dueDate', 'totalAmount'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export type Ordering = 'ASC' | 'DESC';

export interface Account {
  id: string;
  email: string;
  fullname: string;
}

export interface Session {
  accessToken: string;
  tokenType: string;
  expiresIn: number;
  account: Account;
}

export interface Customer {
  id: string;
  fullname: string;
  email: string;
  mobileNumber: string | null;
  address: string | null;
}

export interface InvoiceRow {
  invoiceId: string;
  invoiceNumber: string;
  invoiceReference: string | null;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  currencySymbol: string;
  totalAmount: number;
  balanceAmount: number;
  status: Status;
  customer: Customer;
}

export interface InvoiceItem {
  id: string;
  name: string;
  quantity: number;
  rate: number;
  amount: number;
}

export interface Invoice extends InvoiceRow {
  description: string | null;
  invoiceSubTotal: number;
  taxRate: number;
  totalTax: number;
  totalDiscount: number;
  totalPaid: number;
  items: InvoiceItem[];
  createdBy: string;
  createdAt: string;
}

export interface Paging {
  page: number;
  pageSize: number;
  total: number;
}

export interface Paged<T> {
  data: T[];
  paging: Paging;
}

export interface InvoiceFilters {
  page?: number;
  pageSize?: number;
  sortBy?: SortField;
  ordering?: Ordering;
  status?: Status;
  keyword?: string;
  fromDate?: string;
  toDate?: string;
}

export interface NewInvoice {
  invoiceNumber: string;
  reference?: string;
  invoiceDate: string;
  dueDate: string;
  currency: string;
  description?: string;
  customer: {
    fullname: string;
    email: string;
    mobileNumber?: string;
    address?: string;
  };
  lines: Array<{ name: string; quantity: number; rate: number }>;
  taxRate?: number;
  discount?: number;
}
