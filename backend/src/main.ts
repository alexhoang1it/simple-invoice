import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { corsOrigins, env } from './env';

export const DOCS_PATH = 'api/docs';

async function bootstrap(): Promise<void> {
  const app = await NestFactory.create(AppModule, { bufferLogs: true });

  app.use(helmet());

  app.enableCors({
    origin: corsOrigins,
    methods: ['GET', 'POST', 'PATCH', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Trace-Id'],
    exposedHeaders: ['X-Trace-Id'],
    maxAge: 86_400,
  });

  app.useGlobalPipes(
    new ValidationPipe({
      // Strip anything the DTO does not declare, then reject the request because
      // something was stripped. That is what makes "the server owns the totals"
      // enforceable rather than aspirational: a client sending totalAmount gets
      // a 400 instead of being silently ignored.
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      // Conversions are declared per field with @Type(). Implicit coercion would
      // happily turn "abc" into NaN and let it through @IsNumber().
      transformOptions: { enableImplicitConversion: false },
    }),
  );

  SwaggerModule.setup(DOCS_PATH, app, SwaggerModule.createDocument(app, buildOpenApi()), {
    customSiteTitle: 'SimpleInvoice API',
    swaggerOptions: { persistAuthorization: true, docExpansion: 'list' },
  });

  app.enableShutdownHooks();

  await app.listen(env.PORT, '0.0.0.0');

  const log = new Logger('bootstrap');
  log.log(`API on :${env.PORT} (${env.NODE_ENV})`);
  log.log(`OpenAPI on :${env.PORT}/${DOCS_PATH}`);
}

function buildOpenApi() {
  return new DocumentBuilder()
    .setTitle('SimpleInvoice API')
    .setVersion('1.0.0')
    .setDescription(
      [
        'Invoicing API for the SimpleInvoice web client.',
        '',
        'Everything except `POST /auth/login` and `GET /health` needs a bearer token.',
        'Sign in first, then press **Authorize** and paste the `accessToken`.',
        '',
        'Monetary totals are always calculated here. The create payload has no total',
        'fields at all, and sending one is rejected.',
      ].join('\n'),
    )
    .addBearerAuth({ type: 'http', scheme: 'bearer', bearerFormat: 'JWT' }, 'bearer')
    .build();
}

void bootstrap();
