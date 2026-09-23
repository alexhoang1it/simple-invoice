import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { ACCOUNT, on, renderApp, stubServer } from '~/test/harness';
import { RequireSession } from './RequireSession';

const ME = '/api/auth/me';

function Guarded() {
  return (
    <Routes>
      <Route path="/sign-in" element={<p>Sign-in screen</p>} />
      <Route element={<RequireSession />}>
        <Route path="/invoices" element={<p>Ledger</p>} />
      </Route>
    </Routes>
  );
}

const storedToken = () => window.localStorage.getItem('simpleinvoice.token');

describe('RequireSession', () => {
  it('sends a visitor with no token to the sign-in screen', async () => {
    stubServer();

    renderApp(<Guarded />, { route: '/invoices' });

    expect(await screen.findByText('Sign-in screen')).toBeInTheDocument();
    expect(screen.queryByText('Ledger')).not.toBeInTheDocument();
  });

  it('lets a verified token through', async () => {
    stubServer(on('GET', ME, () => ({ body: ACCOUNT })));

    renderApp(<Guarded />, { route: '/invoices', signedIn: true });

    expect(await screen.findByText('Ledger')).toBeInTheDocument();
  });

  it('waits rather than redirecting while the stored token is being checked', async () => {
    let release: (() => void) | undefined;
    const held = new Promise<void>((resolve) => {
      release = resolve;
    });

    stubServer(
      on('GET', ME, () => {
        // Resolves only once the assertions below have run.
        void held;
        return { body: ACCOUNT };
      }),
    );

    renderApp(<Guarded />, { route: '/invoices', signedIn: true });

    // A page refresh must not bounce a signed-in user back to sign-in.
    expect(screen.getByText('Checking your session')).toBeInTheDocument();
    expect(screen.queryByText('Sign-in screen')).not.toBeInTheDocument();

    release?.();

    expect(await screen.findByText('Ledger')).toBeInTheDocument();
  });

  it('throws away a token the server will not accept', async () => {
    stubServer(
      on('GET', ME, () => ({
        status: 401,
        body: { statusCode: 401, message: 'Session has expired', error: 'Unauthorized' },
      })),
    );

    renderApp(<Guarded />, { route: '/invoices', signedIn: true });

    expect(await screen.findByText('Sign-in screen')).toBeInTheDocument();
    await waitFor(() => expect(storedToken()).toBeNull());
  });

  it('does not strand the user when the API is unreachable at start-up', async () => {
    stubServer(); // no route for /auth/me, so the request fails outright

    renderApp(<Guarded />, { route: '/invoices', signedIn: true });

    expect(await screen.findByText('Sign-in screen')).toBeInTheDocument();
  });
});
