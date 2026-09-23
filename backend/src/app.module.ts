import { type MiddlewareConsumer, Module, type NestModule } from '@nestjs/common';
import { APP_FILTER, APP_GUARD } from '@nestjs/core';
import { DatabaseModule } from './database/database.module';
import { AllErrorsFilter } from './common/all-errors.filter';
import { TraceMiddleware } from './common/trace.middleware';
import { AuthModule } from './auth/auth.module';
import { JwtGuard } from './auth/auth.guard';
import { HealthModule } from './health/health.module';
import { InvoicesModule } from './invoices/invoices.module';

@Module({
  imports: [DatabaseModule, AuthModule, InvoicesModule, HealthModule],
  providers: [
    // Registered application-wide, so a route is authenticated unless it says
    // otherwise with @AllowAnonymous(). New endpoints are protected by default.
    { provide: APP_GUARD, useClass: JwtGuard },
    { provide: APP_FILTER, useClass: AllErrorsFilter },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(TraceMiddleware).forRoutes('*');
  }
}
