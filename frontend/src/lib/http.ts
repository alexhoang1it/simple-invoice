/**
 * The HTTP layer. Native fetch, no client library.
 *
 * There are five endpoints and one auth header; a request library would be more
 * surface area than the thing it wraps.
 */

const BASE = import.meta.env.VITE_API_BASE ?? '/api';

export interface ApiErrorBody {
  statusCode: number;
  message: string | string[];
  error: string;
  traceId?: string;
}

export class ApiError extends Error {
  readonly status: number;
  readonly messages: string[];
  readonly traceId?: string;

  constructor(status: number, messages: string[], traceId?: string) {
    super(messages[0] ?? 'Something went wrong');
    this.name = 'ApiError';
    this.status = status;
    this.messages = messages;
    this.traceId = traceId;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }

  get isNotFound(): boolean {
    return this.status === 404;
  }

  get isConflict(): boolean {
    return this.status === 409;
  }

  /** Status 0 means the request never reached the server at all. */
  get isOffline(): boolean {
    return this.status === 0;
  }
}

let bearer: string | null = null;
let onExpired: (() => void) | null = null;

export function setBearer(token: string | null): void {
  bearer = token;
}

/**
 * Lets the session provider react to a token the server has stopped accepting.
 * A callback rather than an import, so this file stays free of React.
 */
export function onSessionExpired(handler: (() => void) | null): void {
  onExpired = handler;
}

interface RequestOptions {
  method?: 'GET' | 'POST';
  body?: unknown;
  /**
   * Typed as `object` rather than a Record: an interface has no implicit index
   * signature, so a filters interface would not be assignable to one.
   */
  query?: object;
  signal?: AbortSignal;
}

export async function api<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, query, signal } = options;

  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (bearer) headers.Authorization = `Bearer ${bearer}`;

  let response: Response;

  try {
    response = await fetch(BASE + path + toQueryString(query), {
      method,
      headers,
      signal,
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch (cause) {
    // An aborted request is the caller navigating away, not a failure.
    if (cause instanceof DOMException && cause.name === 'AbortError') throw cause;

    throw new ApiError(0, ['Could not reach the server. Is the API running?']);
  }

  if (response.ok) {
    return response.status === 204 ? (undefined as T) : ((await response.json()) as T);
  }

  const error = await toApiError(response);

  // 401 on the sign-in route is a rejected password, not a dead session; tearing
  // the session down there would be wrong.
  if (error.isUnauthorized && !path.startsWith('/auth/login')) {
    onExpired?.();
  }

  throw error;
}

function toQueryString(query: RequestOptions['query']): string {
  if (!query) return '';

  const params = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') params.set(key, String(value));
  }

  const encoded = params.toString();

  return encoded ? `?${encoded}` : '';
}

async function toApiError(response: Response): Promise<ApiError> {
  let body: Partial<ApiErrorBody> | undefined;

  try {
    body = (await response.json()) as Partial<ApiErrorBody>;
  } catch {
    // A proxy error page or an empty body; fall through to the status text.
  }

  const messages = Array.isArray(body?.message)
    ? body.message.filter((m): m is string => typeof m === 'string')
    : typeof body?.message === 'string' && body.message
      ? [body.message]
      : [`Request failed (${response.status})`];

  return new ApiError(response.status, messages, body?.traceId);
}
