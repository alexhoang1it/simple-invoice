import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { fromIsoDate } from '../common/dates';
import { type Page, page, resolveWindow } from '../common/paging';
import { symbolFor } from './currency';
import { type CreateInvoiceDto } from './dto/create-invoice.dto';
import { type InvoiceRow, type InvoiceView } from './dto/invoice.response';
import { type ListInvoicesQuery } from './dto/list-invoices.query';
import { toRow, toView } from './invoice.presenter';
import { InvoicesRepository } from './invoices.repository';
import { computeTotals, DiscountTooLarge } from './totals';

const DEFAULT_TAX_RATE = 10;
const DEFAULT_DISCOUNT = 0;

@Injectable()
export class InvoicesService {
  constructor(private readonly repo: InvoicesRepository) {}

  async list(query: ListInvoicesQuery): Promise<Page<InvoiceRow>> {
    const { page: pageNo, pageSize, skip } = resolveWindow(query);

    // One clock for the request. The predicate that derives Overdue and the
    // presenter that labels each row must not land either side of midnight.
    const now = new Date();

    const [rows, total] = await this.repo.findMany({ query, skip, take: pageSize, now });

    return page(
      rows.map((row) => toRow(row, now)),
      { page: pageNo, pageSize, total },
    );
  }

  async get(id: string): Promise<InvoiceView> {
    const invoice = await this.repo.findById(id);

    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }

    return toView(invoice);
  }

  async create(dto: CreateInvoiceDto, authorId: string): Promise<InvoiceView> {
    const taxRate = dto.taxRate ?? DEFAULT_TAX_RATE;
    const discount = dto.discount ?? DEFAULT_DISCOUNT;

    const totals = this.calculate(dto, taxRate, discount);

    // Cheap look-up so the ordinary duplicate gets a useful message. The unique
    // index is still what guarantees it; a race lands in the error filter as a
    // P2002 and becomes the same 409.
    if (await this.repo.invoiceNumberExists(dto.invoiceNumber)) {
      throw new ConflictException(`Invoice number ${dto.invoiceNumber} is already in use`);
    }

    const created = await this.repo.create({
      createdById: authorId,
      customer: {
        fullname: dto.customer.fullname,
        email: dto.customer.email,
        mobileNumber: dto.customer.mobileNumber,
        address: dto.customer.address,
      },
      invoice: {
        invoiceNumber: dto.invoiceNumber,
        reference: dto.reference ?? null,
        invoiceDate: mustParse(dto.invoiceDate),
        dueDate: mustParse(dto.dueDate),
        currency: dto.currency,
        currencySymbol: symbolFor(dto.currency),
        description: dto.description ?? null,
        // Not negotiable and not client-controllable: everything starts as a draft.
        status: InvoiceStatus.Draft,
        taxRate: dec(taxRate),
        subTotal: dec(totals.subTotal.toFixed(2)),
        taxTotal: dec(totals.taxTotal.toFixed(2)),
        discountTotal: dec(totals.discountTotal.toFixed(2)),
        total: dec(totals.total.toFixed(2)),
        paid: dec(totals.paid.toFixed(2)),
        balance: dec(totals.balance.toFixed(2)),
      },
      lines: dto.lines.map((line, index) => ({
        name: line.name,
        quantity: line.quantity,
        rate: dec(line.rate),
        amount: dec(totals.lineAmounts[index].toFixed(2)),
        sequence: index,
      })),
    });

    return toView(created);
  }

  private calculate(dto: CreateInvoiceDto, taxRate: number, discount: number) {
    try {
      return computeTotals({
        lines: dto.lines.map((l) => ({ quantity: l.quantity, rate: l.rate })),
        taxRate,
        discount,
        // Nothing can have been paid against an invoice that does not exist yet.
        paid: 0,
      });
    } catch (error) {
      if (error instanceof DiscountTooLarge) {
        throw new BadRequestException([error.message]);
      }

      throw error;
    }
  }
}

function dec(value: string | number): Prisma.Decimal {
  return new Prisma.Decimal(value);
}

/** The DTO already validated the format, so a failure here is a programming error. */
function mustParse(isoDate: string): Date {
  const parsed = fromIsoDate(isoDate);

  if (!parsed) {
    throw new Error(`unreachable: ${isoDate} passed validation but will not parse`);
  }

  return parsed;
}
