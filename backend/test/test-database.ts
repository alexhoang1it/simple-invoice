import 'dotenv/config';

/**
 * The end-to-end suite talks to a real Postgres, on its own database.
 *
 * Mocking it away would leave exactly the parts these tests exist for — the
 * list query, the unique index, the CHECK constraints — unexercised. Deriving
 * the name from DATABASE_URL means the suite can never touch development data.
 */
export function testDatabaseUrl(): string {
  const base = process.env.DATABASE_URL;

  if (!base) {
    throw new Error('DATABASE_URL must be set to run the end-to-end suite');
  }

  const url = new URL(base);
  const name = url.pathname.replace(/^\//, '') || 'simpleinvoice';

  if (!name.endsWith('_e2e')) {
    url.pathname = `/${name}_e2e`;
  }

  return url.toString();
}

/** The same server, pointed at the default maintenance database. */
export function adminUrl(): string {
  const url = new URL(testDatabaseUrl());
  url.pathname = '/postgres';
  return url.toString();
}

export function databaseName(): string {
  return new URL(testDatabaseUrl()).pathname.replace(/^\//, '');
}
