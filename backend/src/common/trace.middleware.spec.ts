import { Logger } from '@nestjs/common';
import { type NextFunction, type Request, type Response } from 'express';
import { TRACE_HEADER, TraceMiddleware } from './trace.middleware';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('TraceMiddleware', () => {
  let middleware: TraceMiddleware;
  let setHeader: jest.Mock;
  let once: jest.Mock;
  let next: NextFunction;
  let log: jest.SpyInstance;

  /** Runs whatever the middleware registered for the "finish" event. */
  const finish = () => (once.mock.calls[0]![1] as () => void)();

  const request = (incoming?: string, url = '/invoices'): Request =>
    ({ method: 'GET', originalUrl: url, header: () => incoming }) as unknown as Request;

  const response = (statusCode = 200): Response =>
    ({ setHeader, once, statusCode }) as unknown as Response;

  beforeEach(() => {
    middleware = new TraceMiddleware();
    setHeader = jest.fn();
    once = jest.fn();
    next = jest.fn();
    log = jest.spyOn(Logger.prototype, 'log').mockImplementation(() => undefined);
  });

  describe('the id', () => {
    it('is generated when the caller supplies none', () => {
      const req = request();

      middleware.use(req, response(), next);

      expect(req.traceId).toMatch(UUID);
    });

    it('is taken from the request when one is supplied, so a trace survives the proxy', () => {
      const req = request('from-the-edge');

      middleware.use(req, response(), next);

      expect(req.traceId).toBe('from-the-edge');
    });

    it('comes back on the response', () => {
      middleware.use(request('abc-123'), response(), next);

      expect(setHeader).toHaveBeenCalledWith(TRACE_HEADER, 'abc-123');
    });

    it('is fresh for each request', () => {
      const first = request();
      const second = request();

      middleware.use(first, response(), next);
      middleware.use(second, response(), next);

      expect(first.traceId).not.toBe(second.traceId);
    });

    it.each([
      ['an empty header', ''],
      ['an oversized header', 'x'.repeat(129)],
    ])('is generated instead of trusting %s', (_label, incoming) => {
      const req = request(incoming);

      middleware.use(req, response(), next);

      expect(req.traceId).toMatch(UUID);
    });

    it('accepts a header exactly at the length limit', () => {
      const atLimit = 'x'.repeat(128);
      const req = request(atLimit);

      middleware.use(req, response(), next);

      expect(req.traceId).toBe(atLimit);
    });
  });

  describe('the log line', () => {
    it('is written once the response finishes, not before', () => {
      middleware.use(request(), response(), next);

      expect(log).not.toHaveBeenCalled();

      finish();

      expect(log).toHaveBeenCalledTimes(1);
    });

    it('carries the method, path, status and trace id', () => {
      middleware.use(request('trace-9', '/invoices?page=2'), response(404), next);
      finish();

      const line = log.mock.calls[0]![0] as string;

      expect(line).toContain('GET /invoices?page=2 404');
      expect(line).toContain('[trace-9]');
    });

    it('includes a duration in milliseconds', () => {
      middleware.use(request(), response(), next);
      finish();

      expect(log.mock.calls[0]![0]).toMatch(/\d+\.\d+ms/);
    });
  });

  it('always continues the chain', () => {
    middleware.use(request(), response(), next);

    expect(next).toHaveBeenCalledTimes(1);
  });
});
