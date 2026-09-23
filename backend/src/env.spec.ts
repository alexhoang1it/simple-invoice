import { parseEnv } from './env';

const minimal = {
  DATABASE_URL: 'postgresql://simpleinvoice:pw@localhost:5433/simpleinvoice',
  JWT_SECRET: 'x'.repeat(32),
};

describe('parseEnv', () => {
  it('fills in every default from a minimal environment', () => {
    expect(parseEnv({ ...minimal })).toMatchObject({
      NODE_ENV: 'development',
      PORT: 4000,
      JWT_TTL_SECONDS: 3600,
      PAGE_SIZE_DEFAULT: 10,
      PAGE_SIZE_MAX: 100,
      LOG_SQL: false,
      SEED_INVOICES: 32,
    });
  });

  it('defaults the token lifetime to the 3600 seconds the brief asks for', () => {
    expect(parseEnv({ ...minimal }).JWT_TTL_SECONDS).toBe(3600);
  });

  it('tolerates the rest of process.env, which is always along for the ride', () => {
    expect(() => parseEnv({ ...minimal, PATH: '/usr/bin', HOME: '/root' })).not.toThrow();
  });

  describe('required values', () => {
    it.each(['DATABASE_URL', 'JWT_SECRET'])('refuses to start without %s', (key) => {
      const env: Record<string, string> = { ...minimal };
      delete env[key];

      expect(() => parseEnv(env)).toThrow(/Bad environment configuration/);
    });

    it('names every problem at once instead of one at a time', () => {
      const message = captureMessage(() => parseEnv({}));

      expect(message).toContain('DATABASE_URL');
      expect(message).toContain('JWT_SECRET');
    });

    it('rejects a DATABASE_URL that is not a URL', () => {
      expect(() => parseEnv({ ...minimal, DATABASE_URL: 'localhost:5433' })).toThrow();
    });
  });

  describe('JWT_SECRET', () => {
    it('rejects anything shorter than 32 characters', () => {
      expect(() => parseEnv({ ...minimal, JWT_SECRET: 'x'.repeat(31) })).toThrow(
        /at least 32 characters/,
      );
    });

    it('accepts exactly 32', () => {
      expect(parseEnv({ ...minimal, JWT_SECRET: 'x'.repeat(32) }).JWT_SECRET).toHaveLength(32);
    });
  });

  describe('coercion', () => {
    it('reads numbers out of strings', () => {
      const env = parseEnv({
        ...minimal,
        PORT: '8080',
        JWT_TTL_SECONDS: '900',
        PAGE_SIZE_DEFAULT: '25',
        SEED_INVOICES: '20',
      });

      expect(env).toMatchObject({
        PORT: 8080,
        JWT_TTL_SECONDS: 900,
        PAGE_SIZE_DEFAULT: 25,
        SEED_INVOICES: 20,
      });
    });

    it('rejects a port that is not a number rather than passing NaN along', () => {
      expect(() => parseEnv({ ...minimal, PORT: 'not-a-port' })).toThrow();
    });

    it.each([
      ['true', true],
      ['1', true],
      ['false', false],
      ['0', false],
    ])('reads LOG_SQL=%p as %p', (raw, expected) => {
      expect(parseEnv({ ...minimal, LOG_SQL: raw }).LOG_SQL).toBe(expected);
    });

    it('rejects a boolean it cannot interpret instead of guessing', () => {
      expect(() => parseEnv({ ...minimal, LOG_SQL: 'yes' })).toThrow();
    });
  });

  describe('bounds', () => {
    it.each(['0', '70000'])('rejects port %s', (PORT) => {
      expect(() => parseEnv({ ...minimal, PORT })).toThrow();
    });

    it('rejects a token lifetime under a minute', () => {
      expect(() => parseEnv({ ...minimal, JWT_TTL_SECONDS: '30' })).toThrow();
    });

    it.each(['19', '51'])('rejects a seed count of %s, outside the brief’s 20-50', (count) => {
      expect(() => parseEnv({ ...minimal, SEED_INVOICES: count })).toThrow();
    });

    it('rejects an unknown NODE_ENV', () => {
      expect(() => parseEnv({ ...minimal, NODE_ENV: 'staging' })).toThrow();
      expect(parseEnv({ ...minimal, NODE_ENV: 'production' }).NODE_ENV).toBe('production');
    });
  });
});

function captureMessage(fn: () => unknown): string {
  try {
    fn();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }

  throw new Error('expected the call to throw');
}
