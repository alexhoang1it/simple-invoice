import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { Spinner } from '~/components/ui';
import { useSession } from './session-context';

/**
 * Gate in front of every signed-in route.
 *
 * While the session is still being checked it waits rather than redirecting —
 * treating `checking` as signed out would throw anyone who refreshes the page
 * back to the sign-in screen.
 *
 * Where they were heading rides along in router state, so signing in lands them
 * there instead of on the default page.
 */
export function RequireSession() {
  const { state } = useSession();
  const location = useLocation();

  if (state === 'checking') {
    return <Spinner label="Checking your session" />;
  }

  if (state === 'signed-out') {
    return <Navigate to="/sign-in" replace state={{ from: location }} />;
  }

  return <Outlet />;
}
