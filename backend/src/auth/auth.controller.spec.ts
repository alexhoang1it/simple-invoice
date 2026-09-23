import { AuthController } from './auth.controller';
import { type AuthService } from './auth.service';
import { type AccountDto, type TokenDto } from './dto/auth.response';

const account: AccountDto = {
  id: 'ad1e0902-1928-4345-b513-60c86c94fc91',
  email: 'reviewer@simpleinvoice.dev',
  fullname: 'Ops Reviewer',
};

const token: TokenDto = {
  accessToken: 'header.payload.signature',
  tokenType: 'Bearer',
  expiresIn: 3600,
  account,
};

describe('AuthController', () => {
  let service: jest.Mocked<Pick<AuthService, 'login'>>;
  let controller: AuthController;

  beforeEach(() => {
    service = { login: jest.fn().mockResolvedValue(token) };
    controller = new AuthController(service as unknown as AuthService);
  });

  it('hands the credentials to the service and returns the token', async () => {
    const credentials = { email: 'reviewer@simpleinvoice.dev', password: 'invoice2026' };

    await expect(controller.login(credentials)).resolves.toBe(token);
    expect(service.login).toHaveBeenCalledWith(credentials);
  });

  it('echoes back the account the guard resolved', () => {
    // /auth/me needs no service call: by the time the handler runs, the guard
    // has already loaded the account from the token's subject.
    expect(controller.me(account)).toBe(account);
  });
});
