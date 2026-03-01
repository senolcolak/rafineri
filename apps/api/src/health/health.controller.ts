import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';
import { DRIZZLE_PROVIDER, Database } from '@/database/database.module';
import { RedisService } from '@/database/redis.service';

interface HealthStatus {
  status: 'healthy' | 'unhealthy' | 'degraded';
  timestamp: string;
  version: string;
  services: {
    database: 'up' | 'down';
    redis: 'up' | 'down';
  };
  uptime: number;
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  private readonly startTime: number;

  constructor(
    @Inject(DRIZZLE_PROVIDER) private readonly db: Database,
    private readonly redisService: RedisService,
    private readonly logger: Logger,
  ) {
    this.startTime = Date.now();
  }

  @Get()
  @ApiOperation({ summary: 'Get health status of the API' })
  @ApiResponse({
    status: 200,
    description: 'API is healthy',
    schema: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['healthy', 'unhealthy', 'degraded'] },
        timestamp: { type: 'string', format: 'date-time' },
        version: { type: 'string' },
        services: {
          type: 'object',
          properties: {
            database: { type: 'string', enum: ['up', 'down'] },
            redis: { type: 'string', enum: ['up', 'down'] },
          },
        },
        uptime: { type: 'number', description: 'Uptime in seconds' },
      },
    },
  })
  @ApiResponse({ status: 503, description: 'API is unhealthy' })
  async check(): Promise<HealthStatus> {
    const checks = await Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
    ]);

    const [databaseHealthy, redisHealthy] = checks;
    const allHealthy = databaseHealthy && redisHealthy;
    const anyHealthy = databaseHealthy || redisHealthy;

    const status: HealthStatus['status'] = allHealthy
      ? 'healthy'
      : anyHealthy
        ? 'degraded'
        : 'unhealthy';

    const healthStatus: HealthStatus = {
      status,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      services: {
        database: databaseHealthy ? 'up' : 'down',
        redis: redisHealthy ? 'up' : 'down',
      },
      uptime: Math.floor((Date.now() - this.startTime) / 1000),
    };

    if (status === 'unhealthy') {
      this.logger.error(healthStatus, 'Health check failed');
    } else if (status === 'degraded') {
      this.logger.warn(healthStatus, 'Health check degraded');
    }

    return healthStatus;
  }

  private async checkDatabase(): Promise<boolean> {
    try {
      await this.db.execute('SELECT 1');
      return true;
    } catch (error) {
      this.logger.error({ err: error }, 'Database health check failed');
      return false;
    }
  }

  private async checkRedis(): Promise<boolean> {
    try {
      const client = this.redisService.getClient();
      await client.ping();
      return true;
    } catch (error) {
      this.logger.error({ err: error }, 'Redis health check failed');
      return false;
    }
  }
}
