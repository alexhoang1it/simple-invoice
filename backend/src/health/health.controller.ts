import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import {
  ApiOkResponse,
  ApiOperation,
  ApiServiceUnavailableResponse,
  ApiTags,
} from '@nestjs/swagger';
import { PrismaService } from '../database/prisma.service';
import { AllowAnonymous } from '../auth/auth.guard';

export class HealthDto {
  status: 'ok';
  database: 'reachable';
  uptimeSeconds: number;
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(private readonly prisma: PrismaService) {}

  // Backs the container healthcheck, so it deliberately touches Postgres. An API
  // that cannot reach its database is not ready for traffic, however alive the
  // event loop looks.
  @AllowAnonymous()
  @Get()
  @ApiOperation({ summary: 'Liveness and database reachability' })
  @ApiOkResponse({ type: HealthDto })
  @ApiServiceUnavailableResponse({ description: 'Database unreachable.' })
  async check(): Promise<HealthDto> {
    try {
      await this.prisma.ping();
    } catch {
      throw new ServiceUnavailableException('Database unreachable');
    }

    return { status: 'ok', database: 'reachable', uptimeSeconds: Math.round(process.uptime()) };
  }
}
