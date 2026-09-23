import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { type Request, type Response } from 'express';
import { type ApiError, buildApiError, errorName } from './api-error';

const SERVER_ERROR = 500;

/**
 * Turns anything thrown anywhere into the one documented error body.
 *
 * Nest already formats HttpExceptions consistently. The work here is the rest:
 * Prisma errors, and genuinely unexpected throws, neither of which may reach a
 * client carrying a stack trace or a fragment of SQL.
 */
@Catch()
export class AllErrorsFilter implements ExceptionFilter {
  private readonly log = new Logger('Errors');

  catch(thrown: unknown, host: ArgumentsHost): void {
    const http = host.switchToHttp();
    const req = http.getRequest<Request>();
    const res = http.getResponse<Response>();

    const body = this.describe(thrown, req);

    if (body.statusCode >= SERVER_ERROR) {
      this.log.error(
        `${req.method} ${req.originalUrl} -> ${body.statusCode} [trace=${body.traceId ?? '-'}]`,
        thrown instanceof Error ? thrown.stack : String(thrown),
      );
    }

    res.status(body.statusCode).json(body);
  }

  private describe(thrown: unknown, req: Request): ApiError {
    const base = { path: req.originalUrl, traceId: req.traceId };

    if (thrown instanceof HttpException) {
      const status = thrown.getStatus();
      const payload = thrown.getResponse();

      if (typeof payload === 'string') {
        return buildApiError({ ...base, status, message: payload });
      }

      const shaped = payload as { message?: string | string[]; error?: string };

      return buildApiError({
        ...base,
        status,
        message: shaped.message ?? thrown.message,
        error: shaped.error ?? errorName(status),
      });
    }

    if (thrown instanceof Prisma.PrismaClientKnownRequestError) {
      return buildApiError({ ...base, ...translatePrisma(thrown) });
    }

    return buildApiError({
      ...base,
      status: HttpStatus.INTERNAL_SERVER_ERROR,
      message: 'Internal server error',
    });
  }
}

/**
 * Maps the handful of Prisma codes that correspond to a client mistake. Anything
 * else is our bug and becomes a bare 500.
 *
 * These are a safety net — the invoice service checks for a duplicate number up
 * front so the common case gets a better message. P2002 only surfaces here when
 * two writes race.
 */
function translatePrisma(e: Prisma.PrismaClientKnownRequestError): {
  status: number;
  message: string;
} {
  switch (e.code) {
    case 'P2002':
      return {
        status: HttpStatus.CONFLICT,
        message: `That ${describeTarget(e)} is already in use`,
      };
    case 'P2025':
      return { status: HttpStatus.NOT_FOUND, message: 'Record not found' };
    case 'P2003':
      return { status: HttpStatus.BAD_REQUEST, message: 'Related record does not exist' };
    default:
      return { status: HttpStatus.INTERNAL_SERVER_ERROR, message: 'Internal server error' };
  }
}

function describeTarget(e: Prisma.PrismaClientKnownRequestError): string {
  const target = (e.meta as { target?: string[] | string } | undefined)?.target;
  const fields = Array.isArray(target) ? target : target ? [target] : [];

  return fields.length > 0 ? fields.join(', ') : 'value';
}
