import { z } from 'zod';

// Everything the API reads from the environment, in one place.
//
// Parsed once at import time. If something is missing or malformed the process
// exits before Nest boots, with a list of what to fix — a misconfigured deploy
// should fail at startup, not on the first request that happens to need it.

const bool = z.enum(['true', 'false', '1', '0']).transform((v) => v === 'true' || v === '1');

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),

  // `z.string().url()` is too loose here: `new URL('localhost:5433')` parses
  // happily, treating "localhost" as the scheme. Require the real one.
  DATABASE_URL: z
    .string()
    .regex(/^postgres(ql)?:\/\/.+/, 'DATABASE_URL must be a postgresql:// connection string'),

  // No default. A fallback signing key is how JWT auth quietly stops being auth.
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_TTL_SECONDS: z.coerce.number().int().min(60).default(3600),

  // Comma-separated list of browser origins allowed to call the API.
  CORS_ORIGINS: z.string().default('http://localhost:5174'),

  PAGE_SIZE_DEFAULT: z.coerce.number().int().min(1).default(10),
  PAGE_SIZE_MAX: z.coerce.number().int().min(1).default(100),

  LOG_SQL: bool.default('false'),

  SEED_EMAIL: z.string().email().default('reviewer@simpleinvoice.dev'),
  SEED_PASSWORD: z.string().min(1).default('invoice2026'),
  SEED_NAME: z.string().min(1).default('Ops Reviewer'),
  SEED_INVOICES: z.coerce.number().int().min(20).max(50).default(32),
});

export type Env = z.infer<typeof schema>;

export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = schema.safeParse(source);

  if (!result.success) {
    const lines = result.error.issues.map((i) => `  ${i.path.join('.')}: ${i.message}`);
    throw new Error(`Bad environment configuration:\n${lines.join('\n')}`);
  }

  return result.data;
}

export const env = parseEnv();

export const corsOrigins = env.CORS_ORIGINS.split(',')
  .map((o) => o.trim())
  .filter(Boolean);
