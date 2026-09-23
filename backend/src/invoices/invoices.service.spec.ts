import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { type CreateInvoiceDto } from './dto/create-invoice.dto';
import { type FullInvoice } from './invoice.presenter';
import { type InvoicesRepository } from './invoices.repository';
import { InvoicesService } from './invoices.service';

type Repo = jest.Mocked<
  Pick<InvoicesRepository, 'findMany' | 'findById' | 'invoiceNumberExists' | 'create'>
>;

const dec = (v: string) => new Prisma.Decimal(v);
const day = (iso: string) => new Date(`${iso}T00:00:00.000Z`);

/**
 * Dates hang off today rather than being pinned to a literal, so the fixture
 * does not quietly start deriving Overdue once the calendar moves past a
 * hard-coded due date.
 */
function daysFromNow(offset: number): Date {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() + offset);
  return d;
}

function stored(overrides: Partial<FullInvoice> = {}): FullInvoice {
  return {
    id: 'invoice-1',
    invoiceNumber: 'SI-2026-0148',
    reference: null,
    invoiceDate: daysFromNow(-2),
    dueDate: daysFromNow(28),
    currency: 'AUD',
    currencySymbol: 'AU$',
    description: null,
    status: InvoiceStatus.Draft,
    taxRate: dec('10.00'),
    subTotal: dec('2000.00'),
    taxTotal: dec('200.00'),
    discountTotal: dec('20.00'),
    total: dec('2180.00'),
    paid: dec('0.00'),
    balance: dec('2180.00'),
    customerId: 'customer-1',
    createdById: 'author-1',
    createdAt: new Date('2026-06-03T00:00:00.000Z'),
    updatedAt: new Date('2026-06-03T00:00:00.000Z'),
    customer: {
      id: 'customer-1',
      fullname: 'Braddon Freight Co',
      email: 'ap@braddonfreight.com.au',
      mobileNumber: null,
      address: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    },
    lines: [
      {
        id: 'line-1',
        invoiceId: 'invoice-1',
        name: 'Freight forwarding',
        quantity: 2,
        rate: dec('1000.00'),
        amount: dec('2000.00'),
        sequence: 0,
      },
    ],
    ...overrides,
  };
}

function payload(overrides: Partial<CreateInvoiceDto> = {}): CreateInvoiceDto {
  return {
    invoiceNumber: 'SI-2026-0148',
    invoiceDate: '2026-06-03',
    dueDate: '2026-07-03',
    currency: 'AUD',
    customer: { fullname: 'Braddon Freight Co', email: 'ap@braddonfreight.com.au' },
    lines: [{ name: 'Freight forwarding', quantity: 2, rate: 1000 }],
    ...overrides,
  };
}

describe('InvoicesService', () => {
  let repo: Repo;
  let service: InvoicesService;

  beforeEach(() => {
    repo = {
      findMany: jest.fn().mockResolvedValue([[], 0]),
      findById: jest.fn().mockResolvedValue(stored()),
      invoiceNumberExists: jest.fn().mockResolvedValue(false),
      create: jest.fn().mockResolvedValue(stored()),
    };

    service = new InvoicesService(repo as unknown as InvoicesRepository);
  });

  describe('list', () => {
    it('uses the configured page size when the caller does not ask', async () => {
      const result = await service.list({});

      expect(repo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 0, take: 10 }),
      );
      expect(result.paging).toEqual({ page: 1, pageSize: 10, total: 0 });
    });

    it('skips whole pages', async () => {
      await service.list({ page: 4, pageSize: 25 });

      expect(repo.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 75, take: 25 }),
      );
    });

    it('clamps the page size to the configured maximum', async () => {
      const result = await service.list({ pageSize: 100 });

      // PAGE_SIZE_MAX defaults to 100, so this is the ceiling rather than a cut.
      expect(result.paging.pageSize).toBe(100);
    });

    it('reports the total number of matches, not the size of the page', async () => {
      repo.findMany.mockResolvedValue([[stored()], 94]);

      const result = await service.list({ pageSize: 1 });

      expect(result.data).toHaveLength(1);
      expect(result.paging.total).toBe(94);
    });

    it('passes the filters through to the repository untouched', async () => {
      const query = {
        keyword: 'braddon',
        status: 'Overdue' as const,
        sortBy: 'dueDate' as const,
      };

      await service.list(query);

      expect(repo.findMany).toHaveBeenCalledWith(expect.objectContaining({ query }));
    });

    it('shares one clock between the query and the rendered rows', async () => {
      repo.findMany.mockResolvedValue([[stored()], 1]);

      await service.list({});

      const { now } = repo.findMany.mock.calls[0][0];
      expect(now).toBeInstanceOf(Date);
    });

    it('renders rows through the presenter', async () => {
      repo.findMany.mockResolvedValue([[stored()], 1]);

      const result = await service.list({});

      expect(result.data[0]).toMatchObject({
        invoiceNumber: 'SI-2026-0148',
        totalAmount: 2180,
        customer: { fullname: 'Braddon Freight Co' },
      });
    });
  });

  describe('get', () => {
    it('returns the invoice with its lines', async () => {
      const view = await service.get('invoice-1');

      expect(repo.findById).toHaveBeenCalledWith('invoice-1');
      expect(view.items).toHaveLength(1);
    });

    it('raises a 404 with the documented message for an unknown id', async () => {
      repo.findById.mockResolvedValue(null);

      await expect(service.get('missing')).rejects.toThrow(
        new NotFoundException('Invoice not found'),
      );
    });
  });

  describe('create', () => {
    /** The invoice payload handed to the repository. */
    const written = () => repo.create.mock.calls[0][0];

    /** Prisma's create input allows several money representations; ours are Decimals. */
    const amount = (value: unknown) => (value as Prisma.Decimal).toFixed(2);

    it('works out every total on the server', async () => {
      await service.create(payload({ discount: 20 }), 'author-1');

      expect(written().invoice).toMatchObject({
        subTotal: expect.objectContaining({}),
      });

      const inv = written().invoice;

      expect(amount(inv.subTotal)).toBe('2000.00');
      expect(amount(inv.taxTotal)).toBe('200.00');
      expect(amount(inv.discountTotal)).toBe('20.00');
      expect(amount(inv.total)).toBe('2180.00');
      expect(amount(inv.paid)).toBe('0.00');
      expect(amount(inv.balance)).toBe('2180.00');
    });

    it('defaults the tax rate to 10 per cent', async () => {
      await service.create(payload(), 'author-1');

      const inv = written().invoice;

      expect(amount(inv.taxRate)).toBe('10.00');
      expect(amount(inv.taxTotal)).toBe('200.00');
    });

    it('defaults the discount to nothing', async () => {
      await service.create(payload(), 'author-1');

      const inv = written().invoice;

      expect(amount(inv.discountTotal)).toBe('0.00');
      expect(amount(inv.total)).toBe('2200.00');
    });

    it('always stores a new invoice as a draft', async () => {
      await service.create(payload(), 'author-1');

      expect(written().invoice).toMatchObject({ status: InvoiceStatus.Draft });
    });

    it('resolves the display symbol from the currency code', async () => {
      await service.create(payload({ currency: 'GBP' }), 'author-1');

      expect(written().invoice).toMatchObject({ currency: 'GBP', currencySymbol: '£' });
    });

    it('records the signed-in account as the author', async () => {
      await service.create(payload(), 'author-99');

      expect(written().createdById).toBe('author-99');
    });

    it('stores the line amount alongside the line', async () => {
      await service.create(payload(), 'author-1');

      const line = written().lines[0] as Record<string, unknown>;

      expect(line).toMatchObject({ name: 'Freight forwarding', quantity: 2, sequence: 0 });
      expect((line.amount as Prisma.Decimal).toFixed(2)).toBe('2000.00');
    });

    it('turns the ISO dates into real dates', async () => {
      await service.create(payload(), 'author-1');

      expect(written().invoice.invoiceDate).toEqual(day('2026-06-03'));
      expect(written().invoice.dueDate).toEqual(day('2026-07-03'));
    });

    it('rejects a duplicate invoice number before writing anything', async () => {
      repo.invoiceNumberExists.mockResolvedValue(true);

      await expect(service.create(payload(), 'author-1')).rejects.toThrow(ConflictException);
      expect(repo.create).not.toHaveBeenCalled();
    });

    it('turns an oversized discount into a 400, not a 500', async () => {
      await expect(service.create(payload({ discount: 99999 }), 'author-1')).rejects.toThrow(
        BadRequestException,
      );
    });

    it('does not swallow an unexpected failure from the repository', async () => {
      repo.create.mockRejectedValue(new Error('connection terminated'));

      await expect(service.create(payload(), 'author-1')).rejects.toThrow(
        'connection terminated',
      );
    });

    it('returns the invoice as it was stored', async () => {
      const created = await service.create(payload(), 'author-1');

      expect(created).toMatchObject({ invoiceId: 'invoice-1', status: 'Draft' });
    });
  });
});
