import { Injectable, Logger, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';
import { env } from '../env';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly log = new Logger(PrismaService.name);

  constructor() {
    super({
      log: env.LOG_SQL ? [{ emit: 'event', level: 'query' }] : [],
      errorFormat: 'minimal',
    });
  }

  async onModuleInit(): Promise<void> {
    if (env.LOG_SQL) {
      // @ts-expect-error -- the typed overload only exists when `log` is a
      // literal at compile time; ours is decided at runtime.
      this.$on('query', (e: { query: string; duration: number }) => {
        this.log.debug(`${e.duration}ms ${e.query}`);
      });
    }

    await this.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.$disconnect();
  }

  /** Used by the health probe: cheapest possible round trip to Postgres. */
  async ping(): Promise<void> {
    await this.$queryRaw`SELECT 1`;
  }
}
