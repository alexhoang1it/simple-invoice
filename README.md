# simple-invoice

A small receivables app: sign in, work through a ledger of invoices, open one to
see what is owed on it, and raise new ones. NestJS + Prisma + PostgreSQL behind a
React single-page client.

Written for the 101 Digital full-stack assessment. Everything below is in this
one file — setup, the decisions worth arguing about, and what I left out.

```
web (nginx :8081) ──/api──▶ api (NestJS :4000) ──▶ postgres :5433
   serves the SPA              business rules            3 tables
   proxies /api                JWT, validation
```

## Run it

You need Docker, and nothing else.

```bash
cp .env.example .env
make up            # or: docker compose up --build
```

First run takes a couple of minutes to pull and build. When it settles:

| | |
|---|---|
| Web app | http://localhost:8081 |
| API | http://localhost:4000 |
| OpenAPI / Swagger | http://localhost:4000/api/docs |
| Health probe | http://localhost:4000/health |
| Postgres | `localhost:5433` |

Sign in with:

```
reviewer@simpleinvoice.dev
invoice2026
```

Those are printed by the seed container too (`docker compose logs migrate`) and
shown on the sign-in screen. Change them with `SEED_EMAIL` / `SEED_PASSWORD`.

The ports are off the usual defaults on purpose, so this stack does not fight
anything already listening on 3000/5432/8080. Override `WEB_PORT`, `API_PORT`
and `DB_PORT` in `.env` if they still clash.

```bash
make down          # stop
make down ARGS=-v  # stop and delete the database volume
make reset         # nuke it and start again
```

### Run it without Docker

Node 20.11+ and a PostgreSQL 14+ you can reach.

```bash
make install               # installs both packages
make db                    # or point DATABASE_URL at your own Postgres

cp backend/.env.example backend/.env     # set DATABASE_URL and JWT_SECRET
make seed                        # migrate, then load demo data

make api                   # http://localhost:4000
make web                   # http://localhost:5174   (separate terminal)
```

`JWT_SECRET` has to be at least 32 characters and has no default — an API that
boots with a fallback signing key is an API whose tokens can be forged. Generate
one:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

`make help` lists every target.

## Seeding

```bash
make seed                            # local
docker compose run --rm migrate      # against the compose database
```

Re-runnable: it clears the invoice tables and rebuilds them, so you always land
in the same place. It loads

- the **Appendix A** invoice from the brief, field for field — same id, same
  number `IV1780488206995`, same customer, same amounts, same line item; and
- **32 generated invoices** (`SEED_INVOICES`, 20–50) across five currencies, all
  three stored statuses, amounts spanning three orders of magnitude, and due
  dates either side of today.

Names and amounts come from a fixed-seed PRNG so two runs produce identical
data. Dates are the one deliberate exception — they hang off *today*, so the
Overdue derivation stays demonstrable whenever you happen to run it.

## Tests

```bash
make test        # unit, both packages — 448 tests, no database needed
make cov         # the same with coverage, enforcing a 60% floor
make test-e2e    # API end-to-end against real Postgres — 46 tests
```

| Suite | Runner | Tests | Needs a DB |
|---|---|---:|:-:|
| API unit | Jest | 332 | no |
| API end-to-end | Jest + Supertest | 46 | yes |
| Web unit | Vitest + Testing Library | 116 | no |

Coverage, against a 60% floor enforced in both packages:

| | Statements | Branches | Functions | Lines |
|---|---:|---:|---:|---:|
| API | 95.8% | 82.2% | 93.4% | 95.9% |
| Web | 91.8% | 86.7% | 81.7% | 91.8% |

The floor sits well under the real number on purpose. Pin a threshold to today's
figure and it goes red the first time somebody adds a file, and the reflex fix is
to lower the threshold — which is the exact habit a coverage gate exists to stop.

The split is: business rules are pure functions, so they get exhaustive unit
tests; anything that depends on what Postgres actually does gets an end-to-end
test against a real database, because a mocked repository only ever proves the
mock was called. The end-to-end suite uses its own database (`<name>_e2e`,
created on first run) so it cannot touch your development data.

The web tests stub `fetch` and drive the real components, so a break in the HTTP
layer, the SWR wiring or the error mapping fails a test rather than sliding
through.

Worth knowing about a few of them:

- `totals.spec.ts` reproduces the Appendix A worked example, and pins the cases
  floating-point gets wrong (`3 × 33.33`, tax on `99.99`).
- `lifecycle.spec.ts` covers the Overdue rule in both directions — the label and
  the SQL predicate — including the midnight boundary.
- `app.e2e-spec.ts` opens with the workflow the brief asks for (create an
  invoice, then find it in the list), and separately proves the unique index and
  the CHECK constraints bite when you go around the API.
- `LedgerPage.test.tsx` has a regression test for keyboard focus surviving a
  sort. It was not surviving; see *Things I fixed on the way* below.

## API

Swagger at **http://localhost:4000/api/docs** is generated from the code and is
the reference. Press **Authorize**, paste an `accessToken`, and the protected
endpoints work from the browser.

| Method | Path | Auth | |
|---|---|:-:|---|
| POST | `/auth/login` | – | email + password, returns a JWT |
| GET | `/auth/me` | ✔ | who the token belongs to |
| GET | `/invoices` | ✔ | search, filter, sort, paginate |
| GET | `/invoices/:id` | ✔ | one invoice, with customer and lines |
| POST | `/invoices` | ✔ | raise an invoice |
| GET | `/health` | – | liveness + database reachability |

`GET /invoices` takes `page`, `pageSize`, `sortBy`, `ordering`, `status`,
`keyword`, `fromDate`, `toDate`, and answers:

```json
{
  "data": [ ... ],
  "paging": { "page": 1, "pageSize": 10, "total": 33 }
}
```

Every failure has one shape, whatever threw it:

```json
{
  "statusCode": 400,
  "message": ["dueDate must be on or after invoiceDate"],
  "error": "Bad Request",
  "path": "/invoices",
  "timestamp": "2026-09-23T02:41:18.204Z",
  "traceId": "3f2a...e91"
}
```

`message` is a string for most errors and an array for validation failures —
that is what the brief specifies and what Nest's pipe already produces, so a
client only has one thing to parse. `traceId` comes back in the `X-Trace-Id`
header on every response and goes into the server log, which is what makes a
screenshot of a failure findable afterwards.

Poke at it from a shell:

```bash
TOKEN=$(curl -s localhost:4000/auth/login -H 'Content-Type: application/json' \
  -d '{"email":"reviewer@simpleinvoice.dev","password":"invoice2026"}' \
  | node -pe "JSON.parse(require('fs').readFileSync(0)).accessToken")

curl -s "localhost:4000/invoices?status=Overdue&pageSize=3" -H "Authorization: Bearer $TOKEN"
```

## The rules that matter

**Totals are the server's job.** The create payload has no total fields at all,
and the validation pipe runs with `whitelist` + `forbidNonWhitelisted`, so a
client that sends `totalAmount` gets a 400 rather than being quietly ignored.

```
subTotal = Σ(quantity × rate)
tax      = subTotal × rate%
total    = subTotal + tax − discount
balance  = total − paid
```

Each step is rounded to cents before feeding the next, so the stored figures add
up exactly as the detail page prints them — you can check an invoice with a
calculator and get the same answer.

**Overdue is never stored.** The database holds `Draft`, `Pending`, `Paid` and
nothing else. On the way out:

```
status ≠ Paid  and  dueDate < today   →   Overdue
otherwise                             →   the stored status
```

A stored `Overdue` would be wrong the moment the clock passes midnight and would
stay wrong until some nightly job ran. Deriving it cannot drift.

The *filter* applies the same rule, translated into column predicates
(`status ≠ Paid AND due_date < today`) rather than a SQL `CASE`, which keeps the
`(status, due_date)` index usable. That has a consequence worth stating: a
`Pending` invoice that is past due comes back under `?status=Overdue` and **not**
under `?status=Pending`, so the filter always agrees with the label on the row.
The brief does not say which way that should go; a list that contradicts itself
seemed worse.

Also:

- New invoices are always `Draft`. Status is not client-controllable.
- Invoice numbers are unique, enforced by a database index. The service checks
  first only so the common case gets a readable message; a race still lands on a
  409 via the error filter.
- `dueDate ≥ invoiceDate`, checked in the DTO and again by a CHECK constraint.
- A discount larger than the invoice is a 400, not a negative payable amount.

## Data model

Three tables, plus one enum.

```
users ──< invoices >── customers
              │
              └──< invoice_lines
```

`invoices` carries the money (`numeric(14,2)` throughout), the dates as
`date` (not timestamps — an invoice dated 3 June is dated 3 June everywhere),
and the stored status.

**Customers are their own table**, not columns on the invoice. Invoices to the
same email address share one record, which is what makes a customer's history
something you could report on later, and stops the same address being retyped
for every invoice.

The trade-off, stated plainly: raising a new invoice **updates** the customer's
contact details, so an older invoice will render the current address rather than
the one it was issued to. For a real billing system that is wrong — an invoice
is a legal record of who was billed and where, and the address should be
snapshotted onto the invoice at issue time. Nothing in this app edits customers,
so it does not bite here, but it is the first thing I would change. It is in the
limitations list below.

Constraints the database enforces regardless of what the API does:

| | |
|---|---|
| `invoices_invoice_number_key` | invoice numbers are unique |
| `customers_email_key` | one customer per email |
| `ck_invoices_due_on_or_after_issue` | `due_date ≥ invoice_date` |
| `ck_invoices_tax_rate_range` | `0 ≤ tax_rate ≤ 100` |
| `ck_invoices_amounts_non_negative` | subtotal, tax, discount, total, paid all `≥ 0` |
| `ck_invoice_lines_quantity_positive` | `quantity > 0` |
| `ck_invoice_lines_rate_positive` | `rate > 0` |

`balance_amount` deliberately has no non-negative check: an overpaid invoice has
a negative balance and that is information worth keeping.

Prisma's schema language cannot express a CHECK, so those live in a hand-written
second migration (`src/database/migrations/20260923024500_invoice_guards`).

Indexes cover the sortable columns, and `(status, due_date)` carries the whole
status filter including the derived Overdue.

```bash
docker compose exec db psql -U simpleinvoice -d simpleinvoice
\d invoices
SELECT status, count(*) FROM invoices GROUP BY status;
```

## Layout

A monorepo, following the structure suggested in the brief. The two packages are
installed and versioned independently — they share no code and have genuinely
different dependency trees, so a shared lockfile would only couple their upgrade
cycles. The `Makefile` is the one thing that knows how to drive both.

```
simple-invoice/
├── frontend/                   # ReactJS app
│   └── src/
│       ├── api/                endpoints + wire types
│       ├── auth/               session provider, route gate, sign-in
│       ├── components/         shell, primitives, toasts
│       ├── invoices/           ledger, detail, new-invoice
│       └── lib/                fetch client, formatting, validation
├── backend/                    # NestJS API
│   └── src/
│       ├── auth/               login, JWT strategy, global guard
│       ├── invoices/           controller → service → repository
│       ├── database/
│       │   ├── schema.prisma   models, enum, indexes
│       │   ├── migrations/     init + the CHECK constraints
│       │   ├── seed/           demo data
│       │   └── prisma.service.ts
│       ├── common/             money, dates, paging, errors, tracing
│       ├── health/
│       └── env.ts              Zod-parsed configuration, read once at boot
├── Makefile                    every task, for both packages
├── docker-compose.yml
└── README.md
```

Everything database-related lives under `backend/src/database/` — the schema,
its migrations and the seed — rather than in Prisma's default `prisma/` folder.
`prisma.config.ts` points the CLI there.

On the API side the layering is controller → service → repository, with the two
things most worth testing pulled out as pure functions that import nothing:
`totals.ts` (the arithmetic) and `lifecycle.ts` (the Overdue rule). The
presenter maps rows to the wire shape, which is why the columns can be called
`total` while the API says `totalAmount`.

Authentication is deny-by-default: the JWT guard is registered globally and a
route opts out with `@AllowAnonymous()`. Forgetting the decorator leaves a new
endpoint locked rather than open, which is the failure mode you want.

On the web side, server data lives in SWR, list filters live in the URL (so a
filtered ledger is shareable and survives a refresh, and the SWR cache key falls
out of the query string), and the session lives in a context. Styling is
Tailwind over a small named palette — warm paper, ink, claret — with a serif for
headings, because it should read like a statement rather than a dashboard. The
chrome is a docked bar across the top: it sticks, so the section links and sign
out stay reachable however far down a long ledger you are, and it leaves the full
width to the table. On a narrow screen the links drop onto their own row rather
than fighting the brand and the account for the same line.

## Configuration

Everything comes from the environment; nothing sensitive is committed.
`.env.example` at the root covers Docker, `backend/.env.example` and
`frontend/.env.example` cover running the packages directly.

`backend/src/env.ts` parses the whole environment once with Zod at import time. A
missing or malformed value stops the process before Nest boots, with a list of
what to fix.

| | Default | |
|---|---|---|
| `JWT_SECRET` | *none* | required, ≥ 32 chars |
| `JWT_TTL_SECONDS` | `3600` | access token lifetime |
| `PAGE_SIZE_DEFAULT` / `PAGE_SIZE_MAX` | `10` / `100` | list paging |
| `CORS_ORIGINS` | `http://localhost:5174` | comma-separated |
| `LOG_SQL` | `false` | log every statement |
| `SEED_*` | see `.env.example` | reviewer account and data volume |

## Security

- JWT (HS256), expiry configurable, one hour by default. The token's subject is
  re-read on every request, so deleting an account kills its sessions
  immediately rather than at expiry.
- Passwords hashed with bcrypt. Unknown email and wrong password give the same
  message, and a hash comparison runs even when the account does not exist so
  the two cannot be told apart by timing.
- Every route authenticated unless it says otherwise.
- Unknown properties rejected, not stripped.
- Errors never carry a stack trace or a fragment of SQL; the filter maps
  anything unrecognised to a bare 500 and logs the detail server-side.
- Helmet on the API; `nosniff`, `DENY` framing and a referrer policy from nginx.
- The API container runs as the unprivileged `node` user.

**The trade-off:** the token sits in `localStorage`, so a successful XSS can take
it. An httpOnly `SameSite` cookie is stronger and is what production should use;
it also drags in CSRF handling and a shared site between API and client, which
is past what the brief describes. It is isolated in `frontend/src/lib/storage.ts` —
one file to change.

## Decisions and assumptions

Where the brief left room, or where following it literally had a consequence
worth naming.

1. **A past-due `Draft` reads as `Overdue`.** The rule is `status ≠ Paid AND
   dueDate < today`, which catches drafts. Arguably a draft was never issued so
   nothing can be late — but the brief is unambiguous, so it is implemented as
   written rather than quietly improved.
2. **The status filter matches the label.** Covered above; past-due invoices
   appear only under `Overdue`.
3. **Customers are a separate table, and contact details are not snapshotted.**
   Covered above, and in the limitations.
4. **Everything is UTC.** Due dates are calendar dates, so an invoice tips into
   Overdue at midnight UTC. One clock is taken per request, so a page cannot be
   selected before midnight and labelled after it.
5. **Dates are strictly `YYYY-MM-DD`.** A full ISO timestamp is rejected rather
   than accepted — `2026-06-03T00:00:00+10:00` would otherwise store a different
   day depending on who sent it.
6. **`lines` is an array capped at one.** The brief fixes invoices at a single
   line but asks the model to allow more. The schema, the calculator and the
   presenter all handle many; lifting `ArrayMaxSize` is the only change needed.
7. **`taxRate` is stored** as well as the tax amount. Not in the brief's field
   list, but without it an invoice cannot be re-rendered or re-checked without
   inferring the rate from the figures.
8. **`currencySymbol` is resolved server-side and stored.** Deriving it from the
   viewer's locale would print the same AUD invoice as `A$` for one person and
   `AU$` for another. Unmapped currencies fall back to the ISO code.
9. **`type` and `invoiceGrossTotal` from the Appendix A payload are not
   implemented.** Neither appears in the section 3 data model; there is one kind
   of document, and the gross total is subtotal + tax, both already returned.
10. **Money is `Decimal` end to end** (`numeric(14,2)` in Postgres, decimal.js in
    the application), never a float. The alternative — integers in cents — is
    also exact but puts a division by 100 into every query, migration and
    response.
11. **New invoices have `totalPaid = 0`.** Nothing can have been paid against an
    invoice that did not exist a second ago, so the field is not accepted on
    create. Seeded invoices carry realistic paid amounts so the outstanding
    column has something to show.

## Things I fixed on the way

Found by actually driving the app rather than by a test going red:

- **The new-invoice form collapsed.** Every field was grouped in a `<fieldset>`,
  which carries a UA `min-inline-size: min-content`. That stops a CSS grid inside
  it from shrinking, so the labels stacked and the inputs squeezed to a few
  pixels. They are `<section aria-labelledby>` now, the same pattern the detail
  page uses.
- **Sorting the ledger lost keyboard focus.** SWR briefly reports `isLoading` on
  a key change, the page swapped in the loading skeleton, and that unmounted the
  column header the user was standing on. Branching on `data` instead of
  `isLoading` keeps the table mounted; there is a regression test for it.
- **`pointer-events-none` while refetching** dimmed *and* disabled the table,
  including the sort headers. Now it only dims.
- **Paid invoices claimed to be late.** The due-date hint is a pure function of
  the date, so a settled invoice from last month rendered "20 days late" beside
  a PAID chip. The hint is suppressed once an invoice is paid, on both the ledger
  and the detail page, with tests either way.

## Known limitations

- **Customer details are not snapshotted onto the invoice.** Raising a new
  invoice for an existing email updates that customer, so older invoices render
  current contact details. The fix is to copy name and address onto the invoice
  row at issue time. This is the change I would make first.
- **No refresh tokens.** When the access token expires you sign in again. The
  client notices the 401, clears the session and redirects cleanly, but nothing
  extends it silently.
- **No editing, no payments.** The brief asks for list, detail and create. There
  is no way to move an invoice from Draft to Pending, or to record a payment,
  through the API — those states only arrive via the seed.
- **One line per invoice**, as specified, though everything beneath the DTO
  handles many.
- **Keyword search is a sequential scan.** `contains` with a leading wildcard
  cannot use a B-tree index. Irrelevant at this size; the fix is a `pg_trgm` GIN
  index, left out because `CREATE EXTENSION` needs privileges a managed Postgres
  user often lacks and a migration that fails on first run is a worse first
  impression than a scan over 33 rows.
- **No user registration.** Accounts come from the seed.
- **Token in `localStorage`** — see Security.
- **No browser-level end-to-end test.** The client is covered by component tests
  against a stubbed API and the server by end-to-end tests against real
  Postgres; nothing drives a real browser against the running stack.
- **The CHECK constraints guard ranges, not the arithmetic.** That
  `subtotal + tax − discount = total` is held by the calculator and its tests,
  not by the database.
