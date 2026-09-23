import { createContext, useContext } from 'react';
import type { Account } from '~/api/types';

/**
 * `checking` is the moment just after a reload while a stored token is being
 * verified. Routes must wait it out rather than treating it as signed out,
 * otherwise refreshing the page bounces you to the sign-in screen.
 */
export type SessionState = 'checking' | 'signed-in' | 'signed-out';

export interface SessionValue {
  state: SessionState;
  account: Account | null;
  signIn: (email: string, password: string) => Promise<Account>;
  signOut: () => void;
}

export const SessionContext = createContext<SessionValue | null>(null);

export function useSession(): SessionValue {
  const value = useContext(SessionContext);

  if (!value) {
    throw new Error('useSession must be used inside <SessionProvider>');
  }

  return value;
}
