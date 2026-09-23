import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtGuard } from './auth.guard';
import { type AccountDto } from './dto/auth.response';

const account: AccountDto = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'reviewer@simpleinvoice.dev',
  fullname: 'Ops Reviewer',
};

const ctx = {
  getHandler: () => undefined,
  getClass: () => undefined,
} as unknown as ExecutionContext;

describe('JwtGuard', () => {
  let reflector: Reflector;
  let guard: JwtGuard;

  beforeEach(() => {
    reflector = new Reflector();
    guard = new JwtGuard(reflector);
  });

  /** The mixin AuthGuard('jwt') builds sits one level up the prototype chain. */
  const stubPassport = (result: boolean) =>
    jest
      .spyOn(Object.getPrototypeOf(JwtGuard.prototype) as JwtGuard, 'canActivate')
      .mockReturnValue(result);

  describe('canActivate', () => {
    it('waves through a route marked @AllowAnonymous()', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      expect(guard.canActivate(ctx)).toBe(true);
    });

    it('hands everything else to Passport', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(false);
      const passport = stubPassport(true);

      expect(guard.canActivate(ctx)).toBe(true);
      expect(passport).toHaveBeenCalledWith(ctx);
    });

    it('authenticates when the route says nothing, so new endpoints are closed', () => {
      jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(undefined);
      const passport = stubPassport(true);

      void guard.canActivate(ctx);

      expect(passport).toHaveBeenCalled();
    });

    it('checks the handler and its controller for the marker', () => {
      const lookup = jest.spyOn(reflector, 'getAllAndOverride').mockReturnValue(true);

      void guard.canActivate(ctx);

      expect(lookup).toHaveBeenCalledWith('auth:anonymous', [undefined, undefined]);
    });
  });

  describe('handleRequest', () => {
    it('returns the account Passport resolved', () => {
      expect(guard.handleRequest(null, account, null)).toBe(account);
    });

    it.each([
      ['TokenExpiredError', 'Session has expired, please sign in again'],
      ['JsonWebTokenError', 'Access token is not valid'],
    ])('explains a %s', (name, message) => {
      expect(() => guard.handleRequest(null, false, { name })).toThrow(message);
    });

    it('falls back to a generic message when Passport gives no reason', () => {
      expect(() => guard.handleRequest(null, false, undefined)).toThrow(
        'Authentication required',
      );
    });

    it('throws rather than letting Passport emit a bodyless 401', () => {
      expect(() => guard.handleRequest(null, false, null)).toThrow(UnauthorizedException);
    });

    it('rethrows an error raised by the strategy itself', () => {
      const original = new UnauthorizedException('Account no longer exists');

      expect(() => guard.handleRequest(original, false, null)).toThrow(original);
    });
  });
});
