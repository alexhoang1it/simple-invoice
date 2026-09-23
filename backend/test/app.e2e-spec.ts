import { type INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { InvoiceStatus, Prisma } from '@prisma/client';
import { hash } from 'bcryptjs';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/database/prisma.service';

/**
 * Boots the real application against a real Postgres. Nothing is stubbed: the
 * guards, the pipe, the error filter and the SQL are the ones that run in
 * production.
 */

const REVIEWER = { email: 'e2e@simpleinvoice.dev', password: 'invoice2026', fullname: 'E2E' };

const iso = (offsetDays: number): string => {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
};

const payload = () => ({
  invoiceNumber: 'SI-E2E-0001',
  reference: 'PO-77431',
  invoiceDate: iso(0),
  dueDate: iso(30),
  currency: 'AUD',
  description: 'End to end coverage',
  customer: {
    fullname: 'Braddon Freight Co',
    email: 'ap@braddonfreight.com.au',
    mobileNumber: '+61 2 6100 4455',
    address: '14 Lonsdale St, Braddon ACT 2612',
  },
  lines: [{ name: 'Freight forwarding', quantity: 2, rate: 1000 }],
  taxRate: 10,
  discount: 20,
});

describe('SimpleInvoice API (e2e)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let token: string;
  let reviewerId: string;

  const auth = () => ({ Authorization: `Bearer ${token}` });
  const http = () => request(app.getHttpServer());

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({ imports: [AppModule] }).compile();

    app = moduleRef.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: false },
      }),
    );

    await app.init();

    prisma = app.get(PrismaService);

    const reviewer = await prisma.user.upsert({
      where: { email: REVIEWER.email },
      create: {
        email: REVIEWER.email,
        fullname: REVIEWER.fullname,
        passwordHash: await hash(REVIEWER.password, 4),
      },
      update: { passwordHash: await hash(REVIEWER.password, 4) },
    });

    reviewerId = reviewer.id;

    const signIn = await http()
      .post('/auth/login')
      .send({ email: REVIEWER.email, password: REVIEWER.password })
      .expect(200);

    token = signIn.body.accessToken;
  });

  beforeEach(async () => {
    await prisma.invoiceLine.deleteMany();
    await prisma.invoice.deleteMany();
    await prisma.customer.deleteMany();
  });

  afterAll(async () => {
    await app.close();
  });

  // The workflow the brief asks to be covered end to end.
  describe('create an invoice, then find it again', () => {
    it('stores it and serves it back through both read paths', async () => {
      const created = await http().post('/invoices').set(auth()).send(payload()).expect(201);

      expect(created.body).toMatchObject({
        invoiceNumber: 'SI-E2E-0001',
        status: 'Draft',
        currency: 'AUD',
        currencySymbol: 'AU$',
        invoiceSubTotal: 2000,
        taxRate: 10,
        totalTax: 200,
        totalDiscount: 20,
        totalAmount: 2180,
        totalPaid: 0,
        balanceAmount: 2180,
        createdBy: reviewerId,
      });
      expect(created.body.items).toEqual([
        expect.objectContaining({
          name: 'Freight forwarding',
          quantity: 2,
          rate: 1000,
          amount: 2000,
        }),
      ]);

      const list = await http()
        .get('/invoices')
        .query({ keyword: 'SI-E2E-0001' })
        .set(auth())
        .expect(200);

      expect(list.body.paging).toEqual({ page: 1, pageSize: 10, total: 1 });
      expect(list.body.data[0]).toMatchObject({
        invoiceId: created.body.invoiceId,
        totalAmount: 2180,
        status: 'Draft',
        customer: { fullname: 'Braddon Freight Co' },
      });

      const detail = await http()
        .get(`/invoices/${created.body.invoiceId}`)
        .set(auth())
        .expect(200);

      expect(detail.body).toEqual(created.body);
    });

    it('applies the 10% / zero-discount defaults', async () => {
      const body = payload();
      delete (body as Partial<typeof body>).taxRate;
      delete (body as Partial<typeof body>).discount;

      const created = await http().post('/invoices').set(auth()).send(body).expect(201);

      expect(created.body).toMatchObject({
        taxRate: 10,
        totalTax: 200,
        totalDiscount: 0,
        totalAmount: 2200,
      });
    });

    it('reuses the customer when a second invoice has the same email', async () => {
      await http().post('/invoices').set(auth()).send(payload()).expect(201);
      await http()
        .post('/invoices')
        .set(auth())
        .send({ ...payload(), invoiceNumber: 'SI-E2E-0002' })
        .expect(201);

      await expect(prisma.customer.count()).resolves.toBe(1);
    });
  });

  describe('validation', () => {
    it('rejects a due date before the invoice date', async () => {
      const response = await http()
        .post('/invoices')
        .set(auth())
        .send({ ...payload(), invoiceDate: iso(10), dueDate: iso(9) })
        .expect(400);

      expect(response.body).toMatchObject({ statusCode: 400, error: 'Bad Request' });
      expect(response.body.message).toContain('dueDate must be on or after invoiceDate');
    });

    it('accepts a due date equal to the invoice date', async () => {
      await http()
        .post('/invoices')
        .set(auth())
        .send({ ...payload(), invoiceDate: iso(0), dueDate: iso(0) })
        .expect(201);
    });

    it('refuses a total supplied by the client', async () => {
      await http()
        .post('/invoices')
        .set(auth())
        .send({ ...payload(), totalAmount: 1 })
        .expect(400);
    });

    it.each([
      ['a date that does not exist', { invoiceDate: '2026-02-30' }],
      ['a fractional quantity', { lines: [{ name: 'X', quantity: 1.5, rate: 100 }] }],
      ['a zero quantity', { lines: [{ name: 'X', quantity: 0, rate: 100 }] }],
      ['no lines', { lines: [] }],
      [
        'two lines',
        {
          lines: [
            { name: 'A', quantity: 1, rate: 1 },
            { name: 'B', quantity: 1, rate: 1 },
          ],
        },
      ],
      ['a bad customer email', { customer: { fullname: 'X', email: 'nope' } }],
      ['a bad currency', { currency: 'AUSTRALIAN' }],
      ['a negative discount', { discount: -1 }],
      ['a tax rate over 100', { taxRate: 101 }],
    ])('rejects %s', async (_label, override) => {
      await http()
        .post('/invoices')
        .set(auth())
        .send({ ...payload(), ...override })
        .expect(400);
    });

    it('rejects a discount larger than the invoice', async () => {
      const response = await http()
        .post('/invoices')
        .set(auth())
        .send({ ...payload(), discount: 99999 })
        .expect(400);

      expect(String(response.body.message)).toContain('discount');
    });
  });

  describe('unique invoice numbers', () => {
    it('answers 409 for a duplicate', async () => {
      await http().post('/invoices').set(auth()).send(payload()).expect(201);

      const response = await http()
        .post('/invoices')
        .set(auth())
        .send({
          ...payload(),
          customer: { fullname: 'Someone Else', email: 'else@example.com' },
        })
        .expect(409);

      expect(response.body).toMatchObject({ statusCode: 409, error: 'Conflict' });
    });

    it('is enforced by the database, not only by the service', async () => {
      const created = await http().post('/invoices').set(auth()).send(payload()).expect(201);
      const row = await prisma.invoice.findUniqueOrThrow({
        where: { id: created.body.invoiceId },
      });

      // Straight past the service. Only the unique index can stop this.
      const { id: _id, ...copy } = row;

      await expect(prisma.invoice.create({ data: copy })).rejects.toMatchObject({
        code: 'P2002',
      });
    });
  });

  describe('the database guards the rules too', () => {
    const baseRow = (overrides: Partial<Prisma.InvoiceUncheckedCreateInput> = {}) => ({
      invoiceNumber: `GUARD-${Math.random().toString(36).slice(2, 10)}`,
      invoiceDate: new Date('2026-06-10T00:00:00.000Z'),
      dueDate: new Date('2026-07-10T00:00:00.000Z'),
      currency: 'AUD',
      currencySymbol: 'AU$',
      status: InvoiceStatus.Draft,
      taxRate: new Prisma.Decimal('10.00'),
      subTotal: new Prisma.Decimal('100.00'),
      taxTotal: new Prisma.Decimal('10.00'),
      discountTotal: new Prisma.Decimal('0.00'),
      total: new Prisma.Decimal('110.00'),
      paid: new Prisma.Decimal('0.00'),
      balance: new Prisma.Decimal('110.00'),
      createdById: reviewerId,
      ...overrides,
    });

    async function insert(overrides: Partial<Prisma.InvoiceUncheckedCreateInput>) {
      const customer = await prisma.customer.create({
        data: { fullname: 'Guard Test', email: `guard-${Math.random()}@example.com` },
      });

      return prisma.invoice.create({
        data: { ...baseRow(overrides), customerId: customer.id },
      });
    }

    it('refuses a due date before the invoice date', async () => {
      await expect(insert({ dueDate: new Date('2026-06-09T00:00:00.000Z') })).rejects.toThrow();
    });

    it('refuses a tax rate outside 0-100', async () => {
      await expect(insert({ taxRate: new Prisma.Decimal('101') })).rejects.toThrow();
    });

    it('refuses a negative total', async () => {
      await expect(insert({ total: new Prisma.Decimal('-1') })).rejects.toThrow();
    });

    it('allows a negative balance, because an invoice can be overpaid', async () => {
      await expect(insert({ balance: new Prisma.Decimal('-20.00') })).resolves.toBeDefined();
    });
  });

  describe('reading one invoice', () => {
    it('answers 404 for an id that does not exist', async () => {
      const response = await http()
        .get('/invoices/00000000-0000-4000-8000-000000000000')
        .set(auth())
        .expect(404);

      expect(response.body).toMatchObject({
        statusCode: 404,
        message: 'Invoice not found',
        error: 'Not Found',
      });
    });

    it('answers 400 for an id that is not a UUID', async () => {
      await http().get('/invoices/not-a-uuid').set(auth()).expect(400);
    });
  });

  describe('list management', () => {
    beforeEach(() => seedForList(prisma, reviewerId));

    it('pages on the server without overlap', async () => {
      const first = await http()
        .get('/invoices')
        .query({ page: 1, pageSize: 2, sortBy: 'totalAmount', ordering: 'ASC' })
        .set(auth())
        .expect(200);

      const second = await http()
        .get('/invoices')
        .query({ page: 2, pageSize: 2, sortBy: 'totalAmount', ordering: 'ASC' })
        .set(auth())
        .expect(200);

      expect(first.body.paging).toEqual({ page: 1, pageSize: 2, total: 4 });
      expect(first.body.data).toHaveLength(2);

      const ids = (r: { body: { data: { invoiceId: string }[] } }) =>
        r.body.data.map((row) => row.invoiceId);

      expect(ids(first).some((id) => ids(second).includes(id))).toBe(false);
    });

    it('searches invoice numbers, partially and without case', async () => {
      const response = await http()
        .get('/invoices')
        .query({ keyword: 'lapsed' })
        .set(auth())
        .expect(200);

      expect(response.body.paging.total).toBe(2);
    });

    it('searches customer names, partially and without case', async () => {
      const response = await http()
        .get('/invoices')
        .query({ keyword: 'BRADDON' })
        .set(auth())
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].customer.fullname).toBe('Braddon Freight Co');
    });

    it('returns an empty page rather than an error when nothing matches', async () => {
      const response = await http()
        .get('/invoices')
        .query({ keyword: 'zzzz' })
        .set(auth())
        .expect(200);

      expect(response.body).toEqual({ data: [], paging: { page: 1, pageSize: 10, total: 0 } });
    });

    it('derives Overdue for unpaid invoices past their due date', async () => {
      const response = await http()
        .get('/invoices')
        .query({ status: 'Overdue' })
        .set(auth())
        .expect(200);

      const numbers = response.body.data
        .map((r: { invoiceNumber: string }) => r.invoiceNumber)
        .sort();

      expect(numbers).toEqual(['LAPSED-DRAFT', 'LAPSED-PENDING']);
      expect(response.body.data.every((r: { status: string }) => r.status === 'Overdue')).toBe(
        true,
      );
    });

    it('never calls a paid invoice overdue, however old it is', async () => {
      const response = await http()
        .get('/invoices')
        .query({ status: 'Paid' })
        .set(auth())
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0]).toMatchObject({
        invoiceNumber: 'SETTLED-OLD',
        status: 'Paid',
      });
    });

    it('keeps past-due rows out of Pending, so the filter matches the label', async () => {
      const response = await http()
        .get('/invoices')
        .query({ status: 'Pending' })
        .set(auth())
        .expect(200);

      expect(response.body.data).toHaveLength(1);
      expect(response.body.data[0].invoiceNumber).toBe('CURRENT-PENDING');
    });

    it('sorts by total in both directions', async () => {
      const asc = await http()
        .get('/invoices')
        .query({ sortBy: 'totalAmount', ordering: 'ASC' })
        .set(auth())
        .expect(200);

      const amounts = asc.body.data.map((r: { totalAmount: number }) => r.totalAmount);
      expect(amounts).toEqual([...amounts].sort((a, b) => a - b));

      const desc = await http()
        .get('/invoices')
        .query({ sortBy: 'totalAmount', ordering: 'DESC' })
        .set(auth())
        .expect(200);

      expect(desc.body.data.map((r: { totalAmount: number }) => r.totalAmount)).toEqual(
        [...amounts].reverse(),
      );
    });

    it('filters on the invoice date range', async () => {
      const response = await http()
        .get('/invoices')
        .query({ fromDate: iso(-40), toDate: iso(-20) })
        .set(auth())
        .expect(200);

      expect(response.body.paging.total).toBe(2);
    });

    it('rejects an unsupported sort field instead of ignoring it', async () => {
      const response = await http()
        .get('/invoices')
        .query({ sortBy: 'customerName' })
        .set(auth())
        .expect(400);

      expect(String(response.body.message)).toContain('sortBy must be one of');
    });

    it('rejects a page size above the ceiling', async () => {
      await http().get('/invoices').query({ pageSize: 5000 }).set(auth()).expect(400);
    });
  });

  describe('authentication', () => {
    it('signs a reviewer in', async () => {
      const response = await http()
        .post('/auth/login')
        .send({ email: REVIEWER.email, password: REVIEWER.password })
        .expect(200);

      expect(response.body).toMatchObject({ tokenType: 'Bearer', expiresIn: 3600 });
      expect(response.body.accessToken).toMatch(/^[\w-]+\.[\w-]+\.[\w-]+$/);
      expect(JSON.stringify(response.body)).not.toContain('$2');
    });

    it('accepts the email in any casing', async () => {
      await http()
        .post('/auth/login')
        .send({ email: REVIEWER.email.toUpperCase(), password: REVIEWER.password })
        .expect(200);
    });

    it('gives the same answer for a wrong password and an unknown account', async () => {
      const wrong = await http()
        .post('/auth/login')
        .send({ email: REVIEWER.email, password: 'nope' })
        .expect(401);

      const unknown = await http()
        .post('/auth/login')
        .send({ email: 'nobody@example.com', password: REVIEWER.password })
        .expect(401);

      expect(wrong.body.message).toBe('Email or password is incorrect');
      expect(unknown.body.message).toBe(wrong.body.message);
    });

    it('returns a structured 400 for a malformed email', async () => {
      const response = await http()
        .post('/auth/login')
        .send({ email: 'not-an-email', password: 'x' })
        .expect(400);

      expect(response.body.message).toContain('email must be a valid email address');
    });

    it('answers /auth/me from the token', async () => {
      const response = await http().get('/auth/me').set(auth()).expect(200);

      expect(response.body).toEqual({
        id: reviewerId,
        email: REVIEWER.email,
        fullname: REVIEWER.fullname,
      });
    });

    it.each([
      ['get', '/invoices'],
      ['get', '/invoices/00000000-0000-4000-8000-000000000000'],
      ['post', '/invoices'],
      ['get', '/auth/me'],
    ])('locks %s %s behind a token', async (method, path) => {
      await http()[method as 'get' | 'post'](path).expect(401);
    });

    it('rejects a token that will not verify', async () => {
      const forged = [
        Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })).toString('base64url'),
        Buffer.from(JSON.stringify({ sub: 'nobody' })).toString('base64url'),
        'not-a-signature',
      ].join('.');

      await http().get('/auth/me').set('Authorization', `Bearer ${forged}`).expect(401);
    });

    it('leaves the health probe open and tags responses with a trace id', async () => {
      const response = await http().get('/health').expect(200);

      expect(response.body).toMatchObject({ status: 'ok', database: 'reachable' });
      expect(response.headers['x-trace-id']).toEqual(expect.any(String));
    });
  });
});

/**
 * A small, fully determined population covering each branch of the Overdue
 * rule. Written straight to the database because the API deliberately only
 * creates current-dated drafts.
 */
async function seedForList(prisma: PrismaService, authorId: string): Promise<void> {
  const rows = [
    {
      invoiceNumber: 'LAPSED-PENDING',
      customer: 'Braddon Freight Co',
      days: [-30, -5],
      status: InvoiceStatus.Pending,
      total: '500.00',
      paid: '0.00',
    },
    {
      invoiceNumber: 'LAPSED-DRAFT',
      customer: 'Kanglee Trading',
      days: [-25, -1],
      status: InvoiceStatus.Draft,
      total: '1500.00',
      paid: '0.00',
    },
    {
      invoiceNumber: 'SETTLED-OLD',
      customer: 'Tasman Cold Chain',
      days: [-200, -170],
      status: InvoiceStatus.Paid,
      total: '2500.00',
      paid: '2500.00',
    },
    {
      invoiceNumber: 'CURRENT-PENDING',
      customer: 'Ridgeline Timber',
      days: [-2, 28],
      status: InvoiceStatus.Pending,
      total: '3500.00',
      paid: '0.00',
    },
  ];

  for (const row of rows) {
    const customer = await prisma.customer.create({
      data: { fullname: row.customer, email: `${row.invoiceNumber.toLowerCase()}@example.com` },
    });

    await prisma.invoice.create({
      data: {
        invoiceNumber: row.invoiceNumber,
        invoiceDate: new Date(`${iso(row.days[0])}T00:00:00.000Z`),
        dueDate: new Date(`${iso(row.days[1])}T00:00:00.000Z`),
        currency: 'AUD',
        currencySymbol: 'AU$',
        status: row.status,
        taxRate: new Prisma.Decimal('0.00'),
        subTotal: new Prisma.Decimal(row.total),
        taxTotal: new Prisma.Decimal('0.00'),
        discountTotal: new Prisma.Decimal('0.00'),
        total: new Prisma.Decimal(row.total),
        paid: new Prisma.Decimal(row.paid),
        balance: new Prisma.Decimal(row.total).minus(row.paid),
        customerId: customer.id,
        createdById: authorId,
        lines: {
          create: [
            {
              name: 'Service fee',
              quantity: 1,
              rate: new Prisma.Decimal(row.total),
              amount: new Prisma.Decimal(row.total),
              sequence: 0,
            },
          ],
        },
      },
    });
  }
}
