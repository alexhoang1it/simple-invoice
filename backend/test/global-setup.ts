import { execFileSync } from 'node:child_process';
import { PrismaClient } from '@prisma/client';
import { adminUrl, databaseName, testDatabaseUrl } from './test-database';

/**
 * Creates the end-to-end database if it is not there yet, then brings the
 * schema up to date. Runs once for the whole suite.
 */
export default async function globalSetup(): Promise<void> {
  const name = databaseName();

  // CREATE DATABASE cannot run inside a transaction or against the database it
  // is creating, so this goes through the maintenance database.
  const admin = new PrismaClient({ datasources: { db: { url: adminUrl() } } });

  try {
    const existing = await admin.$queryRawUnsafe<unknown[]>(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      name,
    );

    if (existing.length === 0) {
      // An identifier cannot be parameterised. The value comes from our own
      // DATABASE_URL and is quoted defensively.
      await admin.$executeRawUnsafe(`CREATE DATABASE "${name.replace(/"/g, '""')}"`);
    }
  } finally {
    await admin.$disconnect();
  }

  execFileSync('npx', ['prisma', 'migrate', 'deploy'], {
    stdio: 'inherit',
    shell: process.platform === 'win32',
    env: { ...process.env, DATABASE_URL: testDatabaseUrl() },
  });
}
