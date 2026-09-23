import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { LoginDto } from './login.dto';

const check = (body: unknown): string[] =>
  validateSync(plainToInstance(LoginDto, body), {
    whitelist: true,
    forbidNonWhitelisted: true,
  }).flatMap((e) => Object.values(e.constraints ?? {}));

const shape = (body: unknown) => plainToInstance(LoginDto, body);

const good = { email: 'reviewer@simpleinvoice.dev', password: 'invoice2026' };

describe('LoginDto', () => {
  it('accepts valid credentials', () => {
    expect(check(good)).toEqual([]);
  });

  it.each(['nope', 'nope@', '@example.com', ''])('rejects %p as an email', (email) => {
    expect(check({ ...good, email })).toContain('email must be a valid email address');
  });

  it('normalises the email, so casing and padding do not break sign-in', () => {
    expect(shape({ ...good, email: '  Reviewer@SimpleInvoice.DEV ' }).email).toBe(
      'reviewer@simpleinvoice.dev',
    );
  });

  it('requires a password', () => {
    expect(check({ email: good.email })).toContain('password is required');
    expect(check({ ...good, password: '' })).toContain('password is required');
  });

  it('caps the password length', () => {
    // bcrypt ignores anything past 72 bytes, and an unbounded field is free CPU
    // for whoever wants to waste it.
    expect(check({ ...good, password: 'x'.repeat(73) })).toContain(
      'password cannot exceed 72 characters',
    );
    expect(check({ ...good, password: 'x'.repeat(72) })).toEqual([]);
  });

  it('does not silently accept extra fields', () => {
    expect(check({ ...good, role: 'admin' })).not.toEqual([]);
  });

  it('leaves a non-string email for the validator to reject', () => {
    // The transform must not blow up on a number; @IsEmail reports it instead.
    expect(() => shape({ ...good, email: 42 })).not.toThrow();
    expect(check({ ...good, email: 42 })).not.toEqual([]);
  });
});
