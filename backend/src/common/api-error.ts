import { HttpStatus } from '@nestjs/common';

/**
 * The body every failure returns, whatever threw it.
 *
 * `message` is a single string for most errors and an array for validation
 * failures — that is the shape the brief specifies and the shape Nest's
 * ValidationPipe already produces, so clients only ever parse one thing.
 */
export interface ApiError {
  statusCode: number;
  message: string | string[];
  error: string;
  path: string;
  timestamp: string;
  traceId?: string;
}

const NAMES: Record<number, string> = {
  [HttpStatus.BAD_REQUEST]: 'Bad Request',
  [HttpStatus.UNAUTHORIZED]: 'Unauthorized',
  [HttpStatus.FORBIDDEN]: 'Forbidden',
  [HttpStatus.NOT_FOUND]: 'Not Found',
  [HttpStatus.CONFLICT]: 'Conflict',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Unprocessable Entity',
  [HttpStatus.SERVICE_UNAVAILABLE]: 'Service Unavailable',
  [HttpStatus.INTERNAL_SERVER_ERROR]: 'Internal Server Error',
};

export function errorName(status: number): string {
  return NAMES[status] ?? 'Error';
}

export function buildApiError(input: {
  status: number;
  message: string | string[];
  error?: string;
  path: string;
  traceId?: string;
}): ApiError {
  return {
    statusCode: input.status,
    message: input.message,
    error: input.error ?? errorName(input.status),
    path: input.path,
    timestamp: new Date().toISOString(),
    traceId: input.traceId,
  };
}
