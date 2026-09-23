import { createBrowserRouter, Navigate, type RouteObject } from 'react-router-dom';
import { RequireSession } from '~/auth/RequireSession';
import { SignInPage } from '~/auth/SignInPage';
import { Shell } from '~/components/Shell';
import { InvoicePage } from '~/invoices/InvoicePage';
import { LedgerPage } from '~/invoices/LedgerPage';
import { NewInvoicePage } from '~/invoices/NewInvoicePage';
import { NotFoundPage } from '~/routes/NotFoundPage';

/**
 * Route table.
 *
 * Everything but /sign-in sits behind RequireSession, so an unauthenticated
 * visit to any URL is redirected and then returned afterwards. `new` comes
 * before `:invoiceId` so the literal segment is not swallowed by the parameter.
 */
export const routes: RouteObject[] = [
  { path: '/sign-in', element: <SignInPage /> },
  {
    element: <RequireSession />,
    children: [
      {
        element: <Shell />,
        children: [
          { index: true, element: <Navigate to="/invoices" replace /> },
          { path: 'invoices', element: <LedgerPage /> },
          { path: 'invoices/new', element: <NewInvoicePage /> },
          { path: 'invoices/:invoiceId', element: <InvoicePage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const router = createBrowserRouter(routes);
