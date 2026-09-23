import {
  createParamDecorator,
  type ExecutionContext,
  Injectable,
  SetMetadata,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { type Request } from 'express';
import { type AccountDto } from './dto/auth.response';

const ANONYMOUS = 'auth:anonymous';

/**
 * Opts a route out of the guard, which is registered globally.
 *
 * Doing it this way round matters: forgetting the decorator leaves a new route
 * locked rather than wide open, and that is the failure mode worth having.
 */
export const AllowAnonymous = () => SetMetadata(ANONYMOUS, true);

@Injectable()
export class JwtGuard extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  override canActivate(ctx: ExecutionContext) {
    const anonymous = this.reflector.getAllAndOverride<boolean>(ANONYMOUS, [
      ctx.getHandler(),
      ctx.getClass(),
    ]);

    return anonymous ? true : super.canActivate(ctx);
  }

  // Passport's default is a bare 401 with no body. Throwing routes the failure
  // through the error filter so it looks like every other error the API returns.
  override handleRequest<T = AccountDto>(err: unknown, user: T | false, info: unknown): T {
    if (err instanceof Error) throw err;

    if (!user) {
      throw new UnauthorizedException(reasonFrom(info));
    }

    return user;
  }
}

function reasonFrom(info: unknown): string {
  switch ((info as { name?: string } | undefined)?.name) {
    case 'TokenExpiredError':
      return 'Session has expired, please sign in again';
    case 'JsonWebTokenError':
      return 'Access token is not valid';
    default:
      return 'Authentication required';
  }
}

/** Injects the signed-in account into a handler argument. */
export const Caller = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AccountDto => {
    const request = ctx.switchToHttp().getRequest<Request & { user?: AccountDto }>();

    if (!request.user) {
      // Only reachable if a route were accidentally made anonymous.
      throw new UnauthorizedException('Authentication required');
    }

    return request.user;
  },
);
