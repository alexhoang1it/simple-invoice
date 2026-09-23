import { describe, expect, it } from 'vitest';
import { screen, waitFor } from '@testing-library/react';
import { ACCOUNT, on, renderApp, stubServer, TOKEN } from '~/test/harness';
import { SignInPage } from './SignInPage';

const signInOk = on('POST', '/api/auth/login', (call) => {
  const body = call.body as { password: string };

  return body.password === 'invoice2026'
    ? { body: { accessToken: TOKEN, tokenType: 'Bearer', expiresIn: 3600, account: ACCOUNT } }
    : {
        status: 401,
        body: {
          statusCode: 401,
          message: 'Email or password is incorrect',
          error: 'Unauthorized',
        },
      };
});

const storedToken = () => window.localStorage.getItem('simpleinvoice.token');

describe('SignInPage', () => {
  it('shows the two fields the brief asks for', () => {
    stubServer(signInOk);
    renderApp(<SignInPage />, { route: '/sign-in' });

    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('will not submit an empty form, and says why', async () => {
    const server = stubServer(signInOk);
    const { user } = renderApp(<SignInPage />, { route: '/sign-in' });

    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText('Email is required')).toBeInTheDocument();
    expect(screen.getByText('Password is required')).toBeInTheDocument();
    expect(server.to('/api/auth/login')).toHaveLength(0);
    expect(storedToken()).toBeNull();
  });

  it('catches a malformed email before troubling the API', async () => {
    const server = stubServer(signInOk);
    const { user } = renderApp(<SignInPage />, { route: '/sign-in' });

    await user.type(screen.getByLabelText('Email'), 'not-an-email');
    await user.type(screen.getByLabelText('Password'), 'invoice2026');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByText(/must look like an email address/i)).toBeInTheDocument();
    expect(server.to('/api/auth/login')).toHaveLength(0);
  });

  it('stores the token a successful sign-in returns', async () => {
    stubServer(signInOk);
    const { user } = renderApp(<SignInPage />, { route: '/sign-in' });

    await user.type(screen.getByLabelText('Email'), 'reviewer@simpleinvoice.dev');
    await user.type(screen.getByLabelText('Password'), 'invoice2026');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(storedToken()).toBe(TOKEN));
  });

  it('sends exactly what the user typed', async () => {
    const server = stubServer(signInOk);
    const { user } = renderApp(<SignInPage />, { route: '/sign-in' });

    await user.type(screen.getByLabelText('Email'), 'reviewer@simpleinvoice.dev');
    await user.type(screen.getByLabelText('Password'), 'invoice2026');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => expect(server.to('/api/auth/login')).toHaveLength(1));
    expect(server.to('/api/auth/login')[0]!.body).toEqual({
      email: 'reviewer@simpleinvoice.dev',
      password: 'invoice2026',
    });
  });

  it('shows the server message when the credentials are refused', async () => {
    stubServer(signInOk);
    const { user } = renderApp(<SignInPage />, { route: '/sign-in' });

    await user.type(screen.getByLabelText('Email'), 'reviewer@simpleinvoice.dev');
    await user.type(screen.getByLabelText('Password'), 'wrong-one');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Email or password is incorrect',
    );
    expect(storedToken()).toBeNull();
  });

  it('explains a server it cannot reach, rather than failing silently', async () => {
    stubServer(); // every request throws "no stub", which the client reads as offline
    const { user } = renderApp(<SignInPage />, { route: '/sign-in' });

    await user.type(screen.getByLabelText('Email'), 'reviewer@simpleinvoice.dev');
    await user.type(screen.getByLabelText('Password'), 'invoice2026');
    await user.click(screen.getByRole('button', { name: /sign in/i }));

    expect(await screen.findByRole('alert')).toHaveTextContent(/could not reach the server/i);
  });

  it('blocks a second submit while the first is in flight', async () => {
    stubServer(
      on('POST', '/api/auth/login', () => ({
        body: { accessToken: TOKEN, tokenType: 'Bearer', expiresIn: 3600, account: ACCOUNT },
      })),
    );

    const { user } = renderApp(<SignInPage />, { route: '/sign-in' });

    await user.type(screen.getByLabelText('Email'), 'reviewer@simpleinvoice.dev');
    await user.type(screen.getByLabelText('Password'), 'invoice2026');

    const button = screen.getByRole('button', { name: /sign in/i });
    await user.click(button);

    // Two sessions from one impatient double-click would be a real bug.
    await waitFor(() => expect(storedToken()).toBe(TOKEN));
  });

  it('shows the seeded reviewer credentials so the app can be opened cold', () => {
    stubServer(signInOk);
    renderApp(<SignInPage />, { route: '/sign-in' });

    expect(screen.getByText('reviewer@simpleinvoice.dev')).toBeInTheDocument();
    expect(screen.getByText('invoice2026')).toBeInTheDocument();
  });
});
