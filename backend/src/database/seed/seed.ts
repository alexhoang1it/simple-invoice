import { InvoiceStatus, Prisma, PrismaClient } from '@prisma/client';
import { hash } from 'bcryptjs';
import { config as loadEnv } from 'dotenv';
import { computeTotals } from '../../invoices/totals';
import { symbolFor } from '../../invoices/currency';

loadEnv();

const prisma = new PrismaClient();

const BCRYPT_ROUNDS = 10;

const SEED_EMAIL = process.env.SEED_EMAIL ?? 'reviewer@simpleinvoice.dev';
const SEED_PASSWORD = process.env.SEED_PASSWORD ?? 'invoice2026';
const SEED_NAME = process.env.SEED_NAME ?? 'Ops Reviewer';
const SEED_INVOICES = clamp(Number(process.env.SEED_INVOICES ?? 32), 20, 50);

/**
 * The sample invoice from Appendix A of the brief, reproduced field for field.
 *
 * Its published status is "Overdue", which the schema cannot store, so it goes
 * in as Pending with the same 3 July 2026 due date and reads back as Overdue.
 * Its id and createdBy are fixed so the seeded row matches the document exactly.
 */
const APPENDIX_A = {
  id: '099ca7da-a290-40fa-93b9-1c43ae7bb887',
  authorId: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  invoiceNumber: 'IV1780488206995',
  reference: '#5721662',
  invoiceDate: '2026-06-03',
  dueDate: '2026-07-03',
  currency: 'AUD',
  description: 'Invoice is issued to Kanglee',
  taxRate: 10,
  discount: 20,
  paid: '1451.34',
  createdAt: '2026-06-03T12:03:26.995Z',
  customer: {
    fullname: 'Paul',
    email: 'paul@101digital.io',
    mobileNumber: '947717364111',
    address: 'Singapore',
  },
  line: {
    id: 'b1c2d3e4-0000-0000-0000-000000000001',
    name: 'Honda RC150',
    quantity: 2,
    rate: 1000,
  },
} as const;

const BUYERS = [
  {
    fullname: 'Braddon Freight Co',
    email: 'ap@braddonfreight.com.au',
    mobileNumber: '+61 2 6100 4455',
    address: '14 Lonsdale St, Braddon ACT 2612, Australia',
  },
  {
    fullname: 'Kanglee Trading',
    email: 'accounts@kanglee.com.sg',
    mobileNumber: '+65 6123 4567',
    address: '18 Cross Street #12-01, Singapore 048423',
  },
  {
    fullname: 'Tasman Cold Chain',
    email: 'billing@tasmancold.co.nz',
    mobileNumber: '+64 9 214 8890',
    address: '55 Shortland Street, Auckland 1010, New Zealand',
  },
  {
    fullname: 'Hoang Minh Logistics',
    email: 'ketoan@hoangminh.vn',
    mobileNumber: '+84 28 3822 1199',
    address: '72 Le Thanh Ton, District 1, Ho Chi Minh City, Vietnam',
  },
  {
    fullname: 'Greyshore Analytics',
    email: 'invoices@greyshore.io',
    mobileNumber: '+44 20 7946 0102',
    address: '4 Finsbury Circus, London EC2M 7AA, United Kingdom',
  },
  {
    fullname: 'Marguerite Dubois',
    email: 'm.dubois@atelier-sud.fr',
    mobileNumber: '+33 4 91 22 55 80',
    address: '12 Rue Sainte, 13001 Marseille, France',
  },
  {
    fullname: 'Northfield Dental Group',
    email: 'accounts@northfielddental.com',
    mobileNumber: '+1 415 555 0142',
    address: '900 Larkin Street, San Francisco CA 94109, USA',
  },
  {
    fullname: "O'Meara & Sons",
    email: 'finance@omearaandsons.ie',
    mobileNumber: '+353 1 664 8800',
    address: '9 Merrion Square, Dublin 2, Ireland',
  },
  {
    fullname: 'Puncak Jaya Mining',
    email: 'hutang@puncakjaya.co.id',
    mobileNumber: '+62 21 5150 900',
    address: 'Jl. Jend. Sudirman Kav 52, Jakarta 12190, Indonesia',
  },
  {
    fullname: 'Sato Precision KK',
    email: 'keiri@sato-precision.jp',
    mobileNumber: '+81 3 5501 2200',
    address: '2-7-3 Marunouchi, Chiyoda-ku, Tokyo 100-0005, Japan',
  },
  {
    fullname: 'Ridgeline Timber',
    email: 'ap@ridgelinetimber.com.au',
    mobileNumber: '+61 3 5721 3300',
    address: '88 Vineyard Lane, Rutherglen VIC 3685, Australia',
  },
  {
    fullname: 'Anaya Krishnan',
    email: 'anaya@saffronlabs.in',
    mobileNumber: '+91 80 4123 7788',
    address: 'Prestige Tower, MG Road, Bengaluru 560001, India',
  },
] as const;

const CATALOGUE = [
  { name: 'Freight forwarding — Sydney to Perth', rate: '1450.00' },
  { name: 'Cold storage, per pallet per month', rate: '86.50' },
  { name: 'Customs brokerage — standard entry', rate: '320.00' },
  { name: 'Annual platform licence', rate: '4800.00' },
  { name: 'Honda RC150', rate: '1000.00' },
  { name: 'Implementation consulting, per day', rate: '1650.00' },
  { name: 'Container demurrage', rate: '245.75' },
  { name: 'Last-mile delivery, metro', rate: '58.40' },
  { name: 'Warehouse handling — inbound', rate: '132.00' },
  { name: 'Priority support retainer', rate: '750.00' },
  { name: 'Data migration service', rate: '3400.00' },
  { name: 'Security assessment', rate: '5100.00' },
] as const;

const NOTES = [
  'Services rendered for the period',
  'Quarterly renewal',
  'Milestone 2 delivery per SOW',
  'Consolidated monthly charges',
  'Against purchase order',
  null,
] as const;

const CURRENCIES = ['AUD', 'SGD', 'NZD', 'GBP', 'USD'] as const;
const TERMS = [7, 14, 21, 30, 45, 60] as const;
const TAX_RATES = [0, 5, 7, 10, 15] as const;

async function main(): Promise<void> {
  const author = await upsertReviewer();

  // Wipe the invoice data and rebuild it, so running the seed twice lands in the
  // same place. Lines go first even though the FK cascades — explicit beats
  // relying on a constraint that might change.
  await prisma.invoiceLine.deleteMany();
  await prisma.invoice.deleteMany();
  await prisma.customer.deleteMany();

  const today = startOfTodayUtc();
  let overdue = 0;
  const tally: Record<string, number> = { Draft: 0, Pending: 0, Paid: 0 };

  const records = [appendixA(), ...generated(SEED_INVOICES, today)];

  for (const record of records) {
    await writeInvoice(record, author.id);

    tally[record.status] += 1;
    if (record.status !== InvoiceStatus.Paid && record.dueDate < today) overdue += 1;
  }

  report(records.length, tally, overdue);
}

async function upsertReviewer() {
  const email = SEED_EMAIL.trim().toLowerCase();
  const passwordHash = await hash(SEED_PASSWORD, BCRYPT_ROUNDS);

  // Fixed id so the Appendix A invoice's createdBy resolves to this account.
  return prisma.user.upsert({
    where: { email },
    create: { id: APPENDIX_A.authorId, email, passwordHash, fullname: SEED_NAME },
    // Reset the password too, so changing SEED_PASSWORD and re-seeding works.
    update: { passwordHash, fullname: SEED_NAME },
  });
}

interface SeedInvoice {
  id?: string;
  invoiceNumber: string;
  reference: string | null;
  invoiceDate: Date;
  dueDate: Date;
  currency: string;
  description: string | null;
  status: InvoiceStatus;
  taxRate: number;
  discount: string;
  paid: string;
  createdAt?: Date;
  customer: { fullname: string; email: string; mobileNumber: string; address: string };
  line: { id?: string; name: string; quantity: number; rate: string };
}

function appendixA(): SeedInvoice {
  return {
    id: APPENDIX_A.id,
    invoiceNumber: APPENDIX_A.invoiceNumber,
    reference: APPENDIX_A.reference,
    invoiceDate: isoToDate(APPENDIX_A.invoiceDate),
    dueDate: isoToDate(APPENDIX_A.dueDate),
    currency: APPENDIX_A.currency,
    description: APPENDIX_A.description,
    status: InvoiceStatus.Pending,
    taxRate: APPENDIX_A.taxRate,
    discount: String(APPENDIX_A.discount),
    paid: APPENDIX_A.paid,
    createdAt: new Date(APPENDIX_A.createdAt),
    customer: { ...APPENDIX_A.customer },
    line: { ...APPENDIX_A.line, rate: String(APPENDIX_A.line.rate) },
  };
}

/**
 * Builds the demo population.
 *
 * Amounts, names and statuses come from a fixed-seed PRNG so two runs produce
 * identical data and a "row 14 sorts wrongly" report is reproducible. Dates are
 * the deliberate exception: they hang off today, so the Overdue derivation stays
 * demonstrable no matter when the seed is run.
 */
function generated(count: number, today: Date): SeedInvoice[] {
  const rand = mulberry32(0x5f1c0de);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(rand() * xs.length)];
  const between = (lo: number, hi: number) => lo + Math.floor(rand() * (hi - lo + 1));

  const out: SeedInvoice[] = [];

  for (let i = 0; i < count; i += 1) {
    const invoiceDate = addDays(today, between(-250, 25));
    const dueDate = addDays(invoiceDate, pick(TERMS));
    const item = pick(CATALOGUE);
    const quantity = between(1, 12);
    const taxRate = pick(TAX_RATES);
    const pastDue = dueDate < today;

    const status = pickStatus(rand(), pastDue);

    // One invoice in four carries a discount, rounded to a sensible figure.
    const discount = rand() < 0.25 ? String(between(1, 9) * 25) : '0';

    const totals = computeTotals({
      lines: [{ quantity, rate: item.rate }],
      taxRate,
      discount,
      paid: 0,
    });

    const paid =
      status === InvoiceStatus.Paid
        ? totals.total.toFixed(2)
        : status === InvoiceStatus.Pending && rand() < 0.35
          ? totals.total
              .times(0.1 + rand() * 0.6)
              .toDecimalPlaces(2)
              .toFixed(2)
          : '0.00';

    out.push({
      invoiceNumber: `SI-${isoDate(invoiceDate).replace(/-/g, '')}-${String(i + 1).padStart(3, '0')}`,
      reference: rand() < 0.6 ? `PO-${between(10000, 99999)}` : null,
      invoiceDate,
      dueDate,
      currency: pick(CURRENCIES),
      description: pick(NOTES),
      status,
      taxRate,
      discount,
      paid,
      createdAt: invoiceDate,
      customer: { ...pick(BUYERS) },
      line: { name: item.name, quantity, rate: item.rate },
    });
  }

  return out;
}

/** Never returns Overdue — it is not a storable status. */
function pickStatus(roll: number, pastDue: boolean): InvoiceStatus {
  if (pastDue) {
    // Mostly settled, with enough left outstanding that the Overdue filter has
    // a decent page of results.
    if (roll < 0.45) return InvoiceStatus.Paid;
    if (roll < 0.9) return InvoiceStatus.Pending;
    return InvoiceStatus.Draft;
  }

  if (roll < 0.2) return InvoiceStatus.Paid;
  if (roll < 0.75) return InvoiceStatus.Pending;
  return InvoiceStatus.Draft;
}

async function writeInvoice(record: SeedInvoice, authorId: string): Promise<void> {
  const totals = computeTotals({
    lines: [{ quantity: record.line.quantity, rate: record.line.rate }],
    taxRate: record.taxRate,
    discount: record.discount,
    paid: record.paid,
  });

  await prisma.invoice.create({
    data: {
      id: record.id,
      invoiceNumber: record.invoiceNumber,
      reference: record.reference,
      invoiceDate: record.invoiceDate,
      dueDate: record.dueDate,
      currency: record.currency,
      currencySymbol: symbolFor(record.currency),
      description: record.description,
      status: record.status,
      taxRate: new Prisma.Decimal(record.taxRate),
      subTotal: new Prisma.Decimal(totals.subTotal.toFixed(2)),
      taxTotal: new Prisma.Decimal(totals.taxTotal.toFixed(2)),
      discountTotal: new Prisma.Decimal(totals.discountTotal.toFixed(2)),
      total: new Prisma.Decimal(totals.total.toFixed(2)),
      paid: new Prisma.Decimal(totals.paid.toFixed(2)),
      balance: new Prisma.Decimal(totals.balance.toFixed(2)),
      ...(record.createdAt ? { createdAt: record.createdAt } : {}),
      createdBy: { connect: { id: authorId } },
      customer: {
        connectOrCreate: { where: { email: record.customer.email }, create: record.customer },
      },
      lines: {
        create: [
          {
            id: record.line.id,
            name: record.line.name,
            quantity: record.line.quantity,
            rate: new Prisma.Decimal(record.line.rate),
            amount: new Prisma.Decimal(totals.lineAmounts[0].toFixed(2)),
            sequence: 0,
          },
        ],
      },
    },
  });
}

function report(total: number, tally: Record<string, number>, overdue: number): void {
  console.log(
    [
      '',
      `  ${total} invoices seeded (Appendix A + ${total - 1} generated)`,
      `  stored    Draft ${tally.Draft}   Pending ${tally.Pending}   Paid ${tally.Paid}`,
      `  derived   Overdue ${overdue}`,
      '',
      '  Sign in with',
      `    ${SEED_EMAIL}`,
      `    ${SEED_PASSWORD}`,
      '',
    ].join('\n'),
  );
}

// -- small helpers ----------------------------------------------------------

/** mulberry32: tiny, fast, and deterministic for a given seed. */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;

  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 2 ** 32;
  };
}

function startOfTodayUtc(): Date {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function addDays(from: Date, days: number): Date {
  const next = new Date(from.getTime());
  next.setUTCDate(next.getUTCDate() + days);
  return next;
}

function isoDate(value: Date): string {
  return value.toISOString().slice(0, 10);
}

function isoToDate(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}

function clamp(value: number, lo: number, hi: number): number {
  if (!Number.isFinite(value)) return lo;
  return Math.min(Math.max(Math.trunc(value), lo), hi);
}

main()
  .catch((error: unknown) => {
    console.error('Seed failed:', error instanceof Error ? error.message : error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
