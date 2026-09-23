import { type ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { Caller } from './auth.guard';
import { type AccountDto } from './dto/auth.response';

// A parameter decorator is only reachable through the metadata Nest stores for
// it, so the factory gets pulled off a throwaway class.
function factoryOf(): (data: unknown, ctx: ExecutionContext) => AccountDto {
  class Probe {
    handler(@Caller() account: AccountDto): AccountDto {
      return account;
    }
  }

  const meta = Reflect.getMetadata(ROUTE_ARGS_METADATA, Probe, 'handler') as Record<
    string,
    { factory: (data: unknown, ctx: ExecutionContext) => AccountDto }
  >;

  return meta[Object.keys(meta)[0]].factory;
}

const contextWith = (user?: AccountDto): ExecutionContext =>
  ({ switchToHttp: () => ({ getRequest: () => ({ user }) }) }) as unknown as ExecutionContext;

describe('@Caller()', () => {
  const factory = factoryOf();

  const account: AccountDto = {
    id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
    email: 'reviewer@simpleinvoice.dev',
    fullname: 'Ops Reviewer',
  };

  it('hands the handler the account the guard attached', () => {
    expect(factory(undefined, contextWith(account))).toEqual(account);
  });

  it('fails loudly if the route turns out not to be authenticated', () => {
    // Better a 401 than a handler quietly working with undefined because a route
    // was left anonymous by mistake.
    expect(() => factory(undefined, contextWith(undefined))).toThrow(UnauthorizedException);
  });
});
