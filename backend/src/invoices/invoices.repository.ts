import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../database/prisma.service';
import { fromIsoDate } from '../common/dates';
import { type ListInvoicesQuery, type SortField } from './dto/list-invoices.query';
import { type FullInvoice, type InvoiceWithCustomer } from './invoice.presenter';
import { statusFilter } from './lifecycle';

/** API sort fields mapped to Prisma columns. Nothing else can reach ORDER BY. */
const SORT_COLUMN: Record<SortField, keyof Prisma.InvoiceOrderByWithRelationInput> = {
  invoiceDate: 'invoiceDate',
  dueDate: 'dueDate',
  totalAmount: 'total',
};

export interface FindManyArgs {
  query: ListInvoicesQuery;
  skip: number;
  take: number;
  now: Date;
}

/**
 * All invoice SQL lives here.
 *
 * The service decides what should happen; this decides how to ask Postgres for
 * it. Splitting them keeps the service readable and means the query shapes can
 * be reviewed on their own.
 */
@Injectable()
export class InvoicesRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findMany({
    query,
    skip,
    take,
    now,
  }: FindManyArgs): Promise<[InvoiceWithCustomer[], number]> {
    const where = buildWhere(query, now);

    const orderBy: Prisma.InvoiceOrderByWithRelationInput[] = [
      {
        [SORT_COLUMN[query.sortBy ?? 'invoiceDate']]: query.ordering === 'ASC' ? 'asc' : 'desc',
      },
      // Without a unique tiebreaker, rows sharing a sort value can shuffle
      // between pages and an invoice gets shown twice or skipped entirely.
      { id: 'asc' },
    ];

    // One transaction so the rows and the count cannot disagree about what the
    // table looked like.
    return this.prisma.$transaction([
      this.prisma.invoice.findMany({ where, orderBy, skip, take, include: { customer: true } }),
      this.prisma.invoice.count({ where }),
    ]);
  }

  findById(id: string): Promise<FullInvoice | null> {
    return this.prisma.invoice.findUnique({
      where: { id },
      include: { customer: true, lines: true },
    });
  }

  invoiceNumberExists(invoiceNumber: string): Promise<boolean> {
    return this.prisma.invoice
      .findUnique({ where: { invoiceNumber }, select: { id: true } })
      .then((row) => row !== null);
  }

  /**
   * Creates the invoice, its line, and the customer if that email is new.
   *
   * One interactive transaction rather than a nested write, because Prisma only
   * allows create/connect/connectOrCreate on a to-one relation during a create,
   * and the customer genuinely needs an upsert — contact details from the newest
   * invoice win. (See the trade-off note in the README: a billing system would
   * snapshot them onto the invoice instead.)
   *
   * Wrapping both statements also means a half-written invoice with no lines
   * cannot survive a failure partway through.
   */
  create(args: {
    invoice: Omit<Prisma.InvoiceCreateInput, 'customer' | 'createdBy' | 'lines'>;
    customer: { fullname: string; email: string; mobileNumber?: string; address?: string };
    lines: Prisma.InvoiceLineCreateWithoutInvoiceInput[];
    createdById: string;
  }): Promise<FullInvoice> {
    const { invoice, customer, lines, createdById } = args;

    return this.prisma.$transaction(async (tx) => {
      const party = await tx.customer.upsert({
        where: { email: customer.email },
        create: customer,
        update: {
          fullname: customer.fullname,
          mobileNumber: customer.mobileNumber ?? null,
          address: customer.address ?? null,
        },
      });

      return tx.invoice.create({
        data: {
          ...invoice,
          createdBy: { connect: { id: createdById } },
          customer: { connect: { id: party.id } },
          lines: { create: lines },
        },
        include: { customer: true, lines: true },
      });
    });
  }
}

/** Translates the query string into a Prisma filter. Exported for its own tests. */
export function buildWhere(query: ListInvoicesQuery, now: Date): Prisma.InvoiceWhereInput {
  const and: Prisma.InvoiceWhereInput[] = [];

  if (query.keyword) {
    and.push({
      OR: [
        { invoiceNumber: { contains: query.keyword, mode: 'insensitive' } },
        { customer: { fullname: { contains: query.keyword, mode: 'insensitive' } } },
      ],
    });
  }

  if (query.status) {
    and.push(statusFilter(query.status, now));
  }

  const from = query.fromDate ? fromIsoDate(query.fromDate) : null;
  const to = query.toDate ? fromIsoDate(query.toDate) : null;

  if (from || to) {
    and.push({ invoiceDate: { ...(from ? { gte: from } : {}), ...(to ? { lte: to } : {}) } });
  }

  return and.length > 0 ? { AND: and } : {};
}
