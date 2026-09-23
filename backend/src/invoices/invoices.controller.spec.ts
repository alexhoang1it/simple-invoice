import { type AccountDto } from '../auth/dto/auth.response';
import { type CreateInvoiceDto } from './dto/create-invoice.dto';
import { type InvoiceView } from './dto/invoice.response';
import { InvoicesController } from './invoices.controller';
import { type InvoicesService } from './invoices.service';

// The controller is meant to be thin, so this only checks that the request
// reaches the service unchanged and the result comes back untouched. Testing
// more here would just be testing the service twice.

const caller: AccountDto = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'reviewer@simpleinvoice.dev',
  fullname: 'Ops Reviewer',
};

describe('InvoicesController', () => {
  let service: jest.Mocked<Pick<InvoicesService, 'list' | 'get' | 'create'>>;
  let controller: InvoicesController;

  const listed = { data: [], paging: { page: 1, pageSize: 10, total: 0 } };
  const invoice = { invoiceId: 'invoice-1' } as InvoiceView;

  beforeEach(() => {
    service = {
      list: jest.fn().mockResolvedValue(listed),
      get: jest.fn().mockResolvedValue(invoice),
      create: jest.fn().mockResolvedValue(invoice),
    };

    controller = new InvoicesController(service as unknown as InvoicesService);
  });

  it('forwards the validated query as-is', async () => {
    const query = { page: 2, pageSize: 25, sortBy: 'totalAmount', ordering: 'ASC' } as const;

    await expect(controller.list(query)).resolves.toBe(listed);
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('forwards an empty query so the service applies its defaults', async () => {
    await controller.list({});

    expect(service.list).toHaveBeenCalledWith({});
  });

  it('passes the id through on a detail read', async () => {
    await expect(controller.get('invoice-1')).resolves.toBe(invoice);
    expect(service.get).toHaveBeenCalledWith('invoice-1');
  });

  it('takes the author from the token, not the payload', async () => {
    // CreateInvoiceDto has no createdBy field at all, so the compiler enforces
    // this too; the DTO spec covers a client trying to send one anyway.
    const dto = { invoiceNumber: 'SI-1' } as CreateInvoiceDto;

    await expect(controller.create(dto, caller)).resolves.toBe(invoice);
    expect(service.create).toHaveBeenCalledWith(dto, caller.id);
  });
});
