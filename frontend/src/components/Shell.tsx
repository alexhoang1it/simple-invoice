import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useSession } from '~/auth/session-context';
import { Button } from './ui';

/**
 * The frame every signed-in screen sits in: a docked bar across the top, content
 * beneath it.
 *
 * The bar sticks, so the section links and sign-out stay reachable however far
 * down a long ledger you are. On a narrow screen the links wrap onto their own
 * row rather than competing with the brand and the account for the same line.
 */
export function Shell() {
  const { account, signOut } = useSession();
  const navigate = useNavigate();

  const leave = () => {
    signOut();
    navigate('/sign-in', { replace: true });
  };

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50
                   focus:rounded-sheet focus:bg-claret focus:px-4 focus:py-2 focus:text-paper-raised"
      >
        Skip to content
      </a>

      <header className="sticky top-0 z-40 border-b border-paper-line bg-paper-raised">
        <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center gap-x-8 px-5 py-3 lg:px-8">
          <NavLink to="/invoices" className="order-1 flex items-center gap-3">
            <Mark />
            <span className="leading-tight">
              <span className="block font-serif text-base font-semibold text-ink">
                SimpleInvoice
              </span>
              <span className="block text-2xs uppercase tracking-wider text-ink-faint">
                Receivables
              </span>
            </span>
          </NavLink>

          {account && (
            <div className="order-2 ml-auto flex items-center gap-3 sm:order-3">
              {/* The name is the useful part on a phone; the address is not. */}
              <span className="hidden text-right leading-tight sm:block">
                <span className="block text-sm font-medium">{account.fullname}</span>
                <span className="block text-xs text-ink-faint">{account.email}</span>
              </span>
              <Button tone="secondary" compact onClick={leave}>
                Sign out
              </Button>
            </div>
          )}

          <nav
            aria-label="Sections"
            className="order-3 mt-2 flex w-full items-center gap-1 sm:order-2 sm:mt-0 sm:w-auto"
          >
            <Tab to="/invoices" end>
              Ledger
            </Tab>
            <Tab to="/invoices/new">New invoice</Tab>
          </nav>
        </div>
      </header>

      <main id="content" className="mx-auto w-full max-w-6xl flex-1 px-5 py-6 lg:px-8 lg:py-10">
        <Outlet />
      </main>
    </div>
  );
}

function Tab({ to, end, children }: { to: string; end?: boolean; children: string }) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        [
          'rounded-sheet px-3 py-1.5 text-sm transition-colors',
          isActive
            ? 'bg-claret/10 font-medium text-claret'
            : 'text-ink-soft hover:bg-paper-sunk hover:text-ink',
        ].join(' ')
      }
    >
      {children}
    </NavLink>
  );
}

function Mark() {
  return (
    <svg viewBox="0 0 28 28" className="h-7 w-7 flex-shrink-0" aria-hidden="true">
      <rect width="28" height="28" rx="3" className="fill-claret" />
      <path
        d="M8 7h12v15l-3-1.9L14 22l-3-1.9L8 22V7Z"
        className="fill-paper-raised"
        opacity="0.94"
      />
      <path
        d="M10.8 11h6.4M10.8 14h6.4M10.8 17h3.8"
        className="stroke-claret"
        strokeWidth="1.4"
        strokeLinecap="round"
      />
    </svg>
  );
}
