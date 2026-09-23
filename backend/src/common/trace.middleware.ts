import { Injectable, Logger, type NestMiddleware } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { type NextFunction, type Request, type Response } from 'express';

export const TRACE_HEADER = 'x-trace-id';

declare module 'express' {
  interface Request {
    traceId?: string;
  }
}

/**
 * Tags each request with an id and logs one line when it finishes.
 *
 * An id supplied upstream is honoured so a trace survives the nginx hop; the id
 * comes back on the response and in error bodies, which is what makes a
 * screenshot of a failure findable in the logs.
 *
 * Nothing logs the request body — the login route would put plaintext passwords
 * straight into the log.
 */
@Injectable()
export class TraceMiddleware implements NestMiddleware {
  private readonly log = new Logger('HTTP');

  use(req: Request, res: Response, next: NextFunction): void {
    const supplied = req.header(TRACE_HEADER);
    const traceId = supplied && supplied.length <= 128 ? supplied : randomUUID();

    req.traceId = traceId;
    res.setHeader(TRACE_HEADER, traceId);

    const startedAt = process.hrtime.bigint();

    res.once('finish', () => {
      const ms = Number(process.hrtime.bigint() - startedAt) / 1e6;

      this.log.log(
        `${req.method} ${req.originalUrl} ${res.statusCode} ${ms.toFixed(1)}ms [${traceId}]`,
      );
    });

    next();
  }
}
