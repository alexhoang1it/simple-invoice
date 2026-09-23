import { useNavigate } from 'react-router-dom';
import { Blank, Button } from '~/components/ui';

export function NotFoundPage() {
  const navigate = useNavigate();

  return (
    <Blank
      title="Page not found"
      detail="That address does not match anything in SimpleInvoice."
      action={<Button onClick={() => navigate('/invoices')}>Back to the ledger</Button>}
    />
  );
}
