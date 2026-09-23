import { UnauthorizedException } from '@nestjs/common';
import { type JwtService } from '@nestjs/jwt';
import { hashSync } from 'bcryptjs';
import { type PrismaService } from '../database/prisma.service';
import { AuthService } from './auth.service';

const PASSWORD = 'invoice2026';

const row = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'reviewer@simpleinvoice.dev',
  fullname: 'Ops Reviewer',
  passwordHash: hashSync(PASSWORD, 4),
  createdAt: new Date('2026-01-01T00:00:00.000Z'),
};

describe('AuthService', () => {
  let findUnique: jest.Mock;
  let signAsync: jest.Mock;
  let service: AuthService;

  beforeEach(() => {
    findUnique = jest.fn().mockResolvedValue(row);
    signAsync = jest.fn().mockResolvedValue('header.payload.signature');

    service = new AuthService(
      { user: { findUnique } } as unknown as PrismaService,
      { signAsync } as unknown as JwtService,
    );
  });

  describe('login', () => {
    it('issues a token and returns the account', async () => {
      await expect(service.login({ email: row.email, password: PASSWORD })).resolves.toEqual({
        accessToken: 'header.payload.signature',
        tokenType: 'Bearer',
        expiresIn: 3600,
        account: { id: row.id, email: row.email, fullname: row.fullname },
      });
    });

    it('signs the account id as the subject', async () => {
      await service.login({ email: row.email, password: PASSWORD });

      expect(signAsync).toHaveBeenCalledWith({ sub: row.id, email: row.email });
    });

    it('normalises the email before looking it up', async () => {
      await service.login({ email: '  Reviewer@SimpleInvoice.DEV ', password: PASSWORD });

      expect(findUnique).toHaveBeenCalledWith({ where: { email: row.email } });
    });

    it('never lets the password hash reach the response', async () => {
      const result = await service.login({ email: row.email, password: PASSWORD });

      expect(JSON.stringify(result)).not.toContain('$2');
    });

    it('rejects the wrong password', async () => {
      await expect(service.login({ email: row.email, password: 'wrong' })).rejects.toThrow(
        UnauthorizedException,
      );
      expect(signAsync).not.toHaveBeenCalled();
    });

    it('gives an unknown account the same answer as a wrong password', async () => {
      findUnique.mockResolvedValue(null);
      await expect(
        service.login({ email: 'nobody@example.com', password: PASSWORD }),
      ).rejects.toThrow('Email or password is incorrect');

      findUnique.mockResolvedValue(row);
      await expect(service.login({ email: row.email, password: 'wrong' })).rejects.toThrow(
        'Email or password is incorrect',
      );
    });

    it('still runs a hash comparison for an unknown account', async () => {
      // Bailing out early would make "this email is not registered" measurable
      // from the outside just by timing the response.
      findUnique.mockResolvedValue(null);

      const startedAt = process.hrtime.bigint();
      await expect(
        service.login({ email: 'nobody@example.com', password: PASSWORD }),
      ).rejects.toThrow();
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;

      expect(elapsedMs).toBeGreaterThan(1);
    });
  });

  describe('accountFor', () => {
    it('resolves the account behind a verified token', async () => {
      findUnique.mockResolvedValue({ id: row.id, email: row.email, fullname: row.fullname });

      await expect(service.accountFor({ sub: row.id, email: row.email })).resolves.toEqual({
        id: row.id,
        email: row.email,
        fullname: row.fullname,
      });
    });

    it('asks only for the fields it needs', async () => {
      await service.accountFor({ sub: row.id, email: row.email });

      expect(findUnique).toHaveBeenCalledWith({
        where: { id: row.id },
        select: { id: true, email: true, fullname: true },
      });
    });

    it('rejects a token whose account has been removed', async () => {
      // This is what buys immediate revocation instead of waiting for expiry.
      findUnique.mockResolvedValue(null);

      await expect(service.accountFor({ sub: row.id, email: row.email })).rejects.toThrow(
        UnauthorizedException,
      );
    });
  });
});
