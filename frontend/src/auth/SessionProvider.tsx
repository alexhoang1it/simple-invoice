import { type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useSWRConfig } from 'swr';
import { signIn as requestSignIn, whoAmI } from '~/api/endpoints';
import type { Account } from '~/api/types';
import { onSessionExpired, setBearer } from '~/lib/http';
import { tokenStore } from '~/lib/storage';
import { SessionContext, type SessionState, type SessionValue } from './session-context';

/**
 * Owns the session: the stored token, who it belongs to, and what happens when
 * the server stops accepting it.
 *
 * On mount it verifies a stored token against /auth/me rather than trusting it
 * exists. A token that expired while the tab was shut is thrown away at startup
 * instead of blowing up the first real request.
 */
export function SessionProvider({ children }: { children: ReactNode }) {
  const { mutate } = useSWRConfig();

  const [account, setAccount] = useState<Account | null>(null);
  const [state, setState] = useState<SessionState>(() =>
    tokenStore.read() ? 'checking' : 'signed-out',
  );

  // Survives the extra mount/unmount React 18 StrictMode does in development,
  // so an in-flight check cannot write state after teardown.
  const live = useRef(true);

  const endSession = useCallback(() => {
    tokenStore.clear();
    setBearer(null);
    setAccount(null);
    setState('signed-out');

    // Nothing in the cache belongs to a signed-out user.
    void mutate(() => true, undefined, { revalidate: false });
  }, [mutate]);

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  // Any 401 outside the sign-in call means the token is finished.
  useEffect(() => {
    onSessionExpired(() => {
      if (tokenStore.read()) endSession();
    });

    return () => onSessionExpired(null);
  }, [endSession]);

  useEffect(() => {
    const stored = tokenStore.read();
    if (!stored) return;

    setBearer(stored);

    const abort = new AbortController();

    whoAmI(abort.signal)
      .then((me) => {
        if (!live.current) return;
        setAccount(me);
        setState('signed-in');
      })
      .catch(() => {
        if (!live.current) return;
        // Covers a rejected token and the API simply being down at startup.
        tokenStore.clear();
        setBearer(null);
        setAccount(null);
        setState('signed-out');
      });

    return () => abort.abort();
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<Account> => {
    const session = await requestSignIn(email, password);

    tokenStore.write(session.accessToken);
    setBearer(session.accessToken);
    setAccount(session.account);
    setState('signed-in');

    return session.account;
  }, []);

  const value = useMemo<SessionValue>(
    () => ({ state, account, signIn, signOut: endSession }),
    [state, account, signIn, endSession],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
