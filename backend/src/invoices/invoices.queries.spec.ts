import { type PrismaService } from '../database/prisma.service';
import { InvoicesRepository } from './invoices.repository';

// Covers how the repository asks Postgres for things — the argument shapes
// handed to Prisma. Whether those queries return the right rows is the e2e
// suite's job, against a real database.

describe('InvoicesRepository', () => {
  let prisma: {
    invoice: {
      findMany: jest.Mock;
      count: jest.Mock;
      findUnique: jest.Mock;
      create: jest.Mock;
    };
    $transaction: jest.Mock;
  };
  let repo: InvoicesRepository;

  beforeEach(() => {
    prisma = {
      invoice: {
        findMany: jest.fn().mockResolvedValue([]),
        count: jest.fn().mockResolvedValue(0),
        findUnique: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
      },
      $transaction: jest.fn().mockResolvedValue([[], 0]),
    };

    repo = new InvoicesRepository(prisma as unknown as PrismaService);
  });

  describe('findMany', () => {
    const now = new Date('2026-06-15T00:00:00.000Z');

    const args = () => prisma.invoice.findMany.mock.calls[0]![0] as Record<string, unknown>;

    it('runs the rows and the count in one transaction', async () => {
      await repo.findMany({ query: {}, skip: 0, take: 10, now });

      // Two separate round trips could disagree about what the table held.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
      expect(prisma.$transaction.mock.calls[0]![0]).toHaveLength(2);
    });

    it('applies the requested window', async () => {
      await repo.findMany({ query: {}, skip: 40, take: 20, now });

      expect(args()).toMatchObject({ skip: 40, take: 20 });
    });

    it('loads the customer so a row can show the name without a second query', async () => {
      await repo.findMany({ query: {}, skip: 0, take: 10, now });

      expect(args()).toMatchObject({ include: { customer: true } });
    });

    it('sorts by invoice date descending unless told otherwise', async () => {
      await repo.findMany({ query: {}, skip: 0, take: 10, now });

      expect(args().orderBy).toEqual([{ invoiceDate: 'desc' }, { id: 'asc' }]);
    });

    it('maps the API sort field onto its column', async () => {
      await repo.findMany({
        query: { sortBy: 'totalAmount', ordering: 'ASC' },
        skip: 0,
        take: 10,
        now,
      });

      // totalAmount is exposed by the API; `total` is what the column is called.
      expect(args().orderBy).toEqual([{ total: 'asc' }, { id: 'asc' }]);
    });

    it('always ends the sort with a unique tiebreaker', async () => {
      await repo.findMany({ query: { sortBy: 'dueDate' }, skip: 0, take: 10, now });

      const orderBy = args().orderBy as Record<string, string>[];

      // Without this, rows sharing a due date can reshuffle between pages and an
      // invoice gets shown twice or skipped.
      expect(orderBy[orderBy.length - 1]).toEqual({ id: 'asc' });
    });

    it('passes the filter through to both halves of the transaction', async () => {
      await repo.findMany({ query: { keyword: 'braddon' }, skip: 0, take: 10, now });

      const where = args().where;

      expect(prisma.invoice.count).toHaveBeenCalledWith({ where });
    });
  });

  describe('findById', () => {
    it('loads the customer and the lines', async () => {
      await repo.findById('invoice-1');

      expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { id: 'invoice-1' },
        include: { customer: true, lines: true },
      });
    });
  });

  describe('invoiceNumberExists', () => {
    it('is false when nothing matches', async () => {
      await expect(repo.invoiceNumberExists('SI-1')).resolves.toBe(false);
    });

    it('is true when a row comes back', async () => {
      prisma.invoice.findUnique.mockResolvedValue({ id: 'invoice-1' });

      await expect(repo.invoiceNumberExists('SI-1')).resolves.toBe(true);
    });

    it('asks only for the id, not the whole row', async () => {
      await repo.invoiceNumberExists('SI-1');

      expect(prisma.invoice.findUnique).toHaveBeenCalledWith({
        where: { invoiceNumber: 'SI-1' },
        select: { id: true },
      });
    });
  });

  describe('create', () => {
    // The write runs inside an interactive transaction, so the mock hands the
    // callback a transactional client and records what it was asked to do.
    let tx: { customer: { upsert: jest.Mock }; invoice: { create: jest.Mock } };

    beforeEach(() => {
      tx = {
        customer: { upsert: jest.fn().mockResolvedValue({ id: 'customer-1' }) },
        invoice: { create: jest.fn().mockResolvedValue({ id: 'invoice-1' }) },
      };

      prisma.$transaction.mockImplementation((run: (client: typeof tx) => unknown) => run(tx));
    });

    const call = () =>
      repo.create({
        createdById: 'author-1',
        customer: { fullname: 'Braddon Freight Co', email: 'ap@braddonfreight.com.au' },
        invoice: { invoiceNumber: 'SI-1' } as never,
        lines: [{ name: 'Freight', quantity: 1, rate: 10, amount: 10, sequence: 0 }],
      });

    const data = () =>
      (tx.invoice.create.mock.calls[0]![0] as { data: Record<string, unknown> }).data;

    it('does the whole write in one transaction', async () => {
      await call();

      // A customer created without its invoice would be litter.
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('reuses a customer with the same email instead of duplicating it', async () => {
      await call();

      expect(tx.customer.upsert).toHaveBeenCalledWith(
        expect.objectContaining({ where: { email: 'ap@braddonfreight.com.au' } }),
      );
    });

    it('refreshes the contact details from the newest invoice', async () => {
      await call();

      expect(tx.customer.upsert.mock.calls[0]![0].update).toEqual({
        fullname: 'Braddon Freight Co',
        mobileNumber: null,
        address: null,
      });
    });

    it('links the invoice to the author, the customer and its lines', async () => {
      await call();

      expect(data()).toMatchObject({
        invoiceNumber: 'SI-1',
        createdBy: { connect: { id: 'author-1' } },
        customer: { connect: { id: 'customer-1' } },
      });
      expect(data().lines).toMatchObject({ create: expect.any(Array) });
    });

    it('returns the invoice with its customer and lines attached', async () => {
      await call();

      expect(tx.invoice.create.mock.calls[0]![0]).toMatchObject({
        include: { customer: true, lines: true },
      });
    });
  });
});
