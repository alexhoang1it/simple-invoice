import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { ApiError } from '~/lib/http';
import { email as emailRule, isClean, required, validate } from '~/lib/validate';
import { Button, TextField } from '~/components/ui';
import { useSession } from './session-context';

type Field = 'email' | 'password';

export function SignInPage() {
  const { state, signIn } = useSession();
  const navigate = useNavigate();
  const location = useLocation();

  const [values, setValues] = useState<Record<Field, string>>({ email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string>>>({});
  const [rejection, setRejection] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const emailRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    emailRef.current?.focus();
  }, []);

  // Where they were going before being sent here.
  const destination =
    (location.state as { from?: { pathname?: string } } | null)?.from?.pathname ?? '/invoices';

  if (state === 'signed-in') {
    return <Navigate to={destination} replace />;
  }

  const set = (field: Field) => (event: { target: { value: string } }) => {
    setValues((current) => ({ ...current, [field]: event.target.value }));
  };

  async function submit(event: FormEvent) {
    event.preventDefault();
    setRejection(null);

    // These mirror the API's own rules. They exist for the immediate feedback;
    // the server checks the same payload again and its answer is what counts.
    const found = validate<Field>(values, {
      email: [required('Email'), emailRule()],
      password: [required('Password')],
    });

    setErrors(found);
    if (!isClean(found)) return;

    setBusy(true);

    try {
      await signIn(values.email, values.password);
      navigate(destination, { replace: true });
    } catch (error) {
      setRejection(
        error instanceof ApiError ? error.messages.join(' ') : 'Could not sign in. Try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* The pitch sits across the top, so it reads the same on a phone as it
          does on a desktop rather than being dropped at narrow widths. */}
      <header className="bg-ink px-5 py-10 text-paper sm:px-8 sm:py-14">
        <div className="mx-auto w-full max-w-2xl">
          <div className="mb-7 flex items-center gap-3">
            <Mark />
            <span className="leading-tight">
              <span className="block font-serif text-base font-semibold text-paper">
                SimpleInvoice
              </span>
              <span className="block text-2xs uppercase tracking-widest text-paper/40">
                Receivables ledger
              </span>
            </span>
          </div>

          <h1 className="font-serif text-3xl leading-tight text-paper sm:text-4xl">
            Every invoice, and what is still owed on it.
          </h1>
          <p className="mt-3 max-w-xl text-sm leading-relaxed text-paper/60">
            Raise an invoice, track what has been settled, and see at a glance which ones have
            slipped past their due date.
          </p>
        </div>
      </header>

      {/* Same max-width container as the band above, so the heading and the
          form share a left edge instead of drifting apart. */}
      <main className="w-full flex-1 px-5 py-10 sm:px-8">
        <div className="mx-auto w-full max-w-2xl">
          <div className="w-full max-w-md">
            <h2 className="font-serif text-2xl">Sign in</h2>
            <p className="mb-7 mt-1 text-sm text-ink-soft">Use your SimpleInvoice account.</p>

            <form onSubmit={submit} noValidate className="flex flex-col gap-4">
              {rejection && (
                <p
                  role="alert"
                  className="rounded-sheet border border-claret/40 bg-claret-wash px-3 py-2.5 text-sm text-claret"
                >
                  {rejection}
                </p>
              )}

              <TextField
                ref={emailRef}
                label="Email"
                type="email"
                autoComplete="username"
                placeholder="you@example.com"
                value={values.email}
                onChange={set('email')}
                error={errors.email}
              />

              <TextField
                label="Password"
                type="password"
                autoComplete="current-password"
                value={values.password}
                onChange={set('password')}
                error={errors.password}
              />

              <Button type="submit" busy={busy} className="mt-1 w-full">
                {busy ? 'Signing in…' : 'Sign in'}
              </Button>
            </form>

            <div className="mt-8 border-t border-dashed border-paper-edge pt-4 text-xs leading-relaxed text-ink-faint">
              <p className="mb-1 font-medium text-ink-soft">Reviewer account</p>
              <p className="font-mono">reviewer@simpleinvoice.dev</p>
              <p className="font-mono">invoice2026</p>
              <p className="mt-2">
                Created by <code className="font-mono">make seed</code>; change it with the{' '}
                <code className="font-mono">SEED_*</code> variables.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 28 28" className="h-8 w-8 flex-shrink-0" aria-hidden="true">
      {/* Inverted against the dark band: paper card, claret ruling. */}
      <rect width="28" height="28" rx="3" className="fill-paper" />
      <path d="M8 7h12v15l-3-1.9L14 22l-3-1.9L8 22V7Z" className="fill-claret" opacity="0.9" />
      <path
        d="M10.8 11h6.4M10.8 14h6.4M10.8 17h3.8"
        className="stroke-paper"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
