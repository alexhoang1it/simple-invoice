import 'dotenv/config';
import { testDatabaseUrl } from './test-database';

// Runs before the application module graph loads, so src/env.ts parses these.
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = testDatabaseUrl();
process.env.JWT_SECRET ??= 'end-to-end-signing-key-that-is-long-enough';
process.env.JWT_TTL_SECONDS ??= '3600';
process.env.PAGE_SIZE_DEFAULT ??= '10';
process.env.PAGE_SIZE_MAX ??= '100';
process.env.LOG_SQL = 'false';
