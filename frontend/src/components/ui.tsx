import {
  type ButtonHTMLAttributes,
  forwardRef,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  useId,
} from 'react';
import type { Status } from '~/api/types';

// The handful of primitives the app reuses. Small enough to keep in one file;
// anything that grows a second file's worth of logic moves out.

const join = (...parts: Array<string | false | null | undefined>) =>
  parts.filter(Boolean).join(' ');

// -- Button -----------------------------------------------------------------

type Tone = 'primary' | 'secondary' | 'quiet';

const TONES: Record<Tone, string> = {
  primary:
    'bg-claret text-paper-raised hover:bg-claret-hover border-claret hover:border-claret-hover',
  secondary: 'bg-paper-raised text-ink border-paper-edge hover:bg-paper-sunk',
  quiet: 'bg-transparent text-ink-soft border-transparent hover:bg-paper-sunk hover:text-ink',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  tone?: Tone;
  compact?: boolean;
  busy?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { tone = 'primary', compact, busy, disabled, className, children, type = 'button', ...rest },
  ref,
) {
  return (
    <button
      {...rest}
      ref={ref}
      type={type}
      disabled={disabled || busy}
      aria-busy={busy || undefined}
      className={join(
        'inline-flex items-center justify-center gap-2 rounded-sheet border font-medium',
        'transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        compact ? 'h-8 px-3 text-xs' : 'h-10 px-4 text-sm',
        TONES[tone],
        className,
      )}
    >
      {busy && (
        <span
          aria-hidden="true"
          className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent"
        />
      )}
      {children}
    </button>
  );
});

// -- Text field -------------------------------------------------------------

export interface TextFieldProps extends InputHTMLAttributes<HTMLInputElement> {
  label: string;
  error?: string;
  hint?: string;
  prefix?: string;
  optional?: boolean;
}

export const TextField = forwardRef<HTMLInputElement, TextFieldProps>(function TextField(
  { label, error, hint, prefix, optional, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const inputId = id ?? auto;
  const errorId = `${inputId}-error`;
  const hintId = `${inputId}-hint`;

  return (
    <div className="min-w-0">
      <label className="field-label" htmlFor={inputId}>
        {label}
        {optional && (
          <span className="ml-1.5 font-normal normal-case tracking-normal">optional</span>
        )}
      </label>

      <div className="relative">
        {prefix && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-ink-faint"
          >
            {prefix}
          </span>
        )}
        <input
          {...rest}
          ref={ref}
          id={inputId}
          aria-invalid={error ? true : undefined}
          aria-describedby={join(error && errorId, hint && !error && hintId) || undefined}
          className={join('field-input', prefix && 'pl-9', className)}
        />
      </div>

      {hint && !error && (
        <span className="mt-1 block text-xs text-ink-faint" id={hintId}>
          {hint}
        </span>
      )}
      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

// -- Select -----------------------------------------------------------------

export interface SelectFieldProps extends SelectHTMLAttributes<HTMLSelectElement> {
  label: string;
  options: ReadonlyArray<{ value: string; label: string }>;
  error?: string;
  placeholder?: string;
  hideLabel?: boolean;
}

export const SelectField = forwardRef<HTMLSelectElement, SelectFieldProps>(function SelectField(
  { label, options, error, placeholder, hideLabel, id, className, ...rest },
  ref,
) {
  const auto = useId();
  const selectId = id ?? auto;
  const errorId = `${selectId}-error`;

  return (
    <div className="min-w-0">
      <label className={hideLabel ? 'sr-only' : 'field-label'} htmlFor={selectId}>
        {label}
      </label>

      <select
        {...rest}
        ref={ref}
        id={selectId}
        aria-invalid={error ? true : undefined}
        aria-describedby={error ? errorId : undefined}
        className={join('field-input cursor-pointer pr-8', className)}
      >
        {placeholder && <option value="">{placeholder}</option>}
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>

      {error && (
        <span className="field-error" id={errorId} role="alert">
          {error}
        </span>
      )}
    </div>
  );
});

// -- Status chip ------------------------------------------------------------

const STATUS_STYLE: Record<Status, string> = {
  Draft: 'bg-slate-wash text-slate ring-slate/20',
  Pending: 'bg-brass-wash text-brass ring-brass/25',
  Paid: 'bg-moss-wash text-moss ring-moss/25',
  Overdue: 'bg-claret-wash text-claret ring-claret/25',
};

/**
 * Colour is backed by the word itself, so the four states stay distinguishable
 * without relying on colour vision.
 */
export function StatusChip({ status }: { status: Status }) {
  return (
    <span
      data-testid="status-chip"
      className={join(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-2xs font-semibold uppercase',
        'ring-1 ring-inset',
        STATUS_STYLE[status],
      )}
    >
      {status}
    </span>
  );
}

// -- States -----------------------------------------------------------------

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center py-16" role="status">
      <span
        aria-hidden="true"
        className="h-7 w-7 animate-spin rounded-full border-2 border-paper-edge border-t-claret"
      />
      <span className="sr-only">{label}</span>
    </div>
  );
}

export function Blank({
  title,
  detail,
  action,
}: {
  title: string;
  detail?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center">
      <p className="font-serif text-lg font-semibold">{title}</p>
      {detail && <p className="max-w-sm text-sm text-ink-soft">{detail}</p>}
      {action}
    </div>
  );
}

export function Failed({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const messages =
    error && typeof error === 'object' && 'messages' in error
      ? (error as { messages: string[] }).messages
      : ['The request could not be completed.'];

  const traceId =
    error && typeof error === 'object' && 'traceId' in error
      ? (error as { traceId?: string }).traceId
      : undefined;

  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center" role="alert">
      <p className="font-serif text-lg font-semibold text-claret">That didn&rsquo;t work</p>
      <p className="max-w-sm text-sm text-ink-soft">{messages.join(' ')}</p>
      {/* The only thing that ties a user's screenshot to a line in the log. */}
      {traceId && <p className="font-mono text-2xs text-ink-faint">ref {traceId}</p>}
      {onRetry && (
        <Button tone="secondary" compact onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

/** Placeholder rows, so the table keeps its height while a page loads. */
export function SkeletonRows({ rows = 6, cols = 6 }: { rows?: number; cols?: number }) {
  return (
    <tbody aria-hidden="true">
      {Array.from({ length: rows }, (_, r) => (
        <tr key={r} className="border-t border-paper-line">
          {Array.from({ length: cols }, (_, c) => (
            <td key={c} className="px-4 py-3.5">
              <span className="block h-3 animate-pulse rounded bg-paper-sunk" />
            </td>
          ))}
        </tr>
      ))}
    </tbody>
  );
}
