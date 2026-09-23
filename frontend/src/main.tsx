import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { RouterProvider } from 'react-router-dom';
import { SWRConfig } from 'swr';
import { SessionProvider } from '~/auth/SessionProvider';
import { Toasts } from '~/components/Toasts';
import { ApiError } from '~/lib/http';
import { router } from '~/router';
import './index.css';

const mount = document.getElementById('root');

if (!mount) {
  throw new Error('#root is missing from index.html');
}

createRoot(mount).render(
  <StrictMode>
    <SWRConfig
      value={{
        revalidateOnFocus: false,
        // 4xx is the server's final answer; only retry transport trouble and 5xx.
        shouldRetryOnError: (error: unknown) =>
          !(error instanceof ApiError && error.status >= 400 && error.status < 500),
        errorRetryCount: 2,
      }}
    >
      <SessionProvider>
        <Toasts>
          <RouterProvider router={router} />
        </Toasts>
      </SessionProvider>
    </SWRConfig>
  </StrictMode>,
);
