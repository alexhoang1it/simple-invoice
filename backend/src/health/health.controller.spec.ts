import { ServiceUnavailableException } from '@nestjs/common';
import { type PrismaService } from '../database/prisma.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let ping: jest.Mock;
  let controller: HealthController;

  beforeEach(() => {
    ping = jest.fn().mockResolvedValue(undefined);
    controller = new HealthController({ ping } as unknown as PrismaService);
  });

  it('reports healthy when the database answers', async () => {
    await expect(controller.check()).resolves.toEqual({
      status: 'ok',
      database: 'reachable',
      uptimeSeconds: expect.any(Number),
    });
  });

  it('really queries the database rather than just proving the process is alive', async () => {
    // The container healthcheck hangs off this: an API that cannot reach
    // Postgres should not be taking traffic, however healthy the event loop is.
    await controller.check();

    expect(ping).toHaveBeenCalledTimes(1);
  });

  it('reports unavailable when the database cannot be reached', async () => {
    ping.mockRejectedValue(new Error('connection refused'));

    await expect(controller.check()).rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('does not pass the driver error on to the caller', async () => {
    ping.mockRejectedValue(
      new Error('password authentication failed for user "simpleinvoice"'),
    );

    await expect(controller.check()).rejects.toThrow('Database unreachable');
  });
});
