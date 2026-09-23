import {
  type ArgumentsHost,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { AllErrorsFilter } from './all-errors.filter';
import { type ApiError } from './api-error';

function prismaError(code: string, meta?: Record<string, unknown>) {
  return new Prisma.PrismaClientKnownRequestError('boom', {
    code,
    clientVersion: '6.0.0',
    meta,
  });
}

describe('AllErrorsFilter', () => {
  let filter: AllErrorsFilter;
  let json: jest.Mock;
  let status: jest.Mock;
  let request: { method: string; originalUrl: string; traceId?: string };

  const sent = (): ApiError => json.mock.calls[0]![0] as ApiError;
  const code = (): number => status.mock.calls[0]![0] as number;

  const host = () =>
    ({
      switchToHttp: () => ({
        getRequest: () => request,
        getResponse: () => ({ status, json }),
      }),
    }) as unknown as ArgumentsHost;

  beforeEach(() => {
    json = jest.fn();
    status = jest.fn().mockReturnValue({ json });
    request = { method: 'GET', originalUrl: '/invoices', traceId: 'trace-1' };
    filter = new AllErrorsFilter();

    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
  });

  describe('HttpException', () => {
    it('keeps the status, message and name', () => {
      filter.catch(new NotFoundException('Invoice not found'), host());

      expect(code()).toBe(404);
      expect(sent()).toMatchObject({
        statusCode: 404,
        message: 'Invoice not found',
        error: 'Not Found',
      });
    });

    it('keeps the message array a validation failure produces', () => {
      filter.catch(
        new BadRequestException(['dueDate must be on or after invoiceDate']),
        host(),
      );

      expect(sent()).toMatchObject({
        statusCode: 400,
        message: ['dueDate must be on or after invoiceDate'],
        error: 'Bad Request',
      });
    });

    it('handles an exception built from a bare string', () => {
      filter.catch(new HttpException('Nope', 409), host());

      expect(sent()).toMatchObject({ statusCode: 409, message: 'Nope', error: 'Conflict' });
    });

    it.each([
      [new UnauthorizedException(), 401, 'Unauthorized'],
      [new ForbiddenException(), 403, 'Forbidden'],
      [new ConflictException(), 409, 'Conflict'],
    ])('names %# correctly', (thrown, expected, name) => {
      filter.catch(thrown, host());

      expect(sent()).toMatchObject({ statusCode: expected, error: name });
    });

    it('falls back to a generic name for a status it does not map', () => {
      filter.catch(new HttpException('Gone', 410), host());

      expect(sent().error).toBe('Error');
    });
  });

  describe('Prisma errors', () => {
    it('turns a unique violation into a 409', () => {
      filter.catch(prismaError('P2002', { target: ['invoice_number'] }), host());

      expect(code()).toBe(409);
      expect(sent().message).toContain('invoice_number');
    });

    it('copes with a unique violation that names no column', () => {
      filter.catch(prismaError('P2002'), host());

      expect(code()).toBe(409);
      expect(sent().message).toBe('That value is already in use');
    });

    it('maps a missing record to 404 and a bad relation to 400', () => {
      filter.catch(prismaError('P2025'), host());
      expect(code()).toBe(404);

      json.mockClear();
      status.mockClear();

      filter.catch(prismaError('P2003'), host());
      expect(code()).toBe(400);
    });

    it('does not leak details of an unrecognised Prisma failure', () => {
      filter.catch(prismaError('P2021', { table: 'secret_table' }), host());

      expect(code()).toBe(500);
      expect(sent().message).toBe('Internal server error');
      expect(JSON.stringify(sent())).not.toContain('secret_table');
    });
  });

  describe('anything else', () => {
    it('becomes a bare 500', () => {
      filter.catch(new Error('connection terminated unexpectedly'), host());

      expect(code()).toBe(500);
      expect(sent()).toMatchObject({
        message: 'Internal server error',
        error: 'Internal Server Error',
      });
    });

    it('never puts a stack trace in the body', () => {
      filter.catch(new Error('boom'), host());

      expect(JSON.stringify(sent())).not.toMatch(/at .*\.ts:/);
    });

    it('survives a thrown value that is not an Error', () => {
      filter.catch('something went wrong', host());

      expect(code()).toBe(500);
    });

    it('logs server faults with the trace id', () => {
      const log = jest.spyOn(Logger.prototype, 'error');

      filter.catch(new Error('boom'), host());

      expect(log).toHaveBeenCalledWith(
        expect.stringContaining('trace=trace-1'),
        expect.any(String),
      );
    });

    it('does not log a 404 as if it were our fault', () => {
      const log = jest.spyOn(Logger.prototype, 'error');

      filter.catch(new NotFoundException(), host());

      expect(log).not.toHaveBeenCalled();
    });
  });

  describe('envelope', () => {
    it('carries the path, an ISO timestamp and the trace id', () => {
      filter.catch(new NotFoundException('Invoice not found'), host());

      const body = sent();

      expect(body.path).toBe('/invoices');
      expect(body.traceId).toBe('trace-1');
      expect(new Date(body.timestamp).toISOString()).toBe(body.timestamp);
    });

    it('still answers when no trace id was assigned', () => {
      request = { method: 'GET', originalUrl: '/invoices' };

      filter.catch(new NotFoundException(), host());

      expect(sent().traceId).toBeUndefined();
    });
  });
});
