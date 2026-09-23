import { type Customer, type Invoice, type InvoiceLine } from '@prisma/client';
import { toIsoDate } from '../common/dates';
import { asNumber } from '../common/money';
import {
  type CustomerView,
  type InvoiceItemView,
  type InvoiceRow,
  type InvoiceView,
} from './dto/invoice.response';
import { effectiveStatus } from './lifecycle';

export type InvoiceWithCustomer = Invoice & { customer: Customer };
export type FullInvoice = InvoiceWithCustomer & { lines: InvoiceLine[] };

/**
 * Turns database rows into the wire shape.
 *
 * Keeping this separate from both the entity and the service means the columns
 * can be renamed without it being an API change, and the derived status is
 * applied in exactly one place.
 *
 * `now` is a parameter so a whole page shares one clock and tests can pin it.
 */
export function toRow(invoice: InvoiceWithCustomer, now: Date = new Date()): InvoiceRow {
  return {
    invoiceId: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    invoiceReference: invoice.reference,
    invoiceDate: toIsoDate(invoice.invoiceDate),
    dueDate: toIsoDate(invoice.dueDate),
    currency: invoice.currency,
    currencySymbol: invoice.currencySymbol,
    totalAmount: asNumber(invoice.total),
    balanceAmount: asNumber(invoice.balance),
    status: effectiveStatus(invoice.status, invoice.dueDate, now),
    customer: toCustomer(invoice.customer),
  };
}

export function toView(invoice: FullInvoice, now: Date = new Date()): InvoiceView {
  const lines = [...(invoice.lines ?? [])].sort((a, b) => a.sequence - b.sequence);

  return {
    ...toRow(invoice, now),
    description: invoice.description,
    invoiceSubTotal: asNumber(invoice.subTotal),
    taxRate: asNumber(invoice.taxRate),
    totalTax: asNumber(invoice.taxTotal),
    totalDiscount: asNumber(invoice.discountTotal),
    totalPaid: asNumber(invoice.paid),
    items: lines.map(toItem),
    createdBy: invoice.createdById,
    createdAt: invoice.createdAt.toISOString(),
  };
}

function toCustomer(customer: Customer): CustomerView {
  return {
    id: customer.id,
    fullname: customer.fullname,
    email: customer.email,
    mobileNumber: customer.mobileNumber,
    address: customer.address,
  };
}

function toItem(line: InvoiceLine): InvoiceItemView {
  return {
    id: line.id,
    name: line.name,
    quantity: line.quantity,
    rate: asNumber(line.rate),
    amount: asNumber(line.amount),
  };
}
