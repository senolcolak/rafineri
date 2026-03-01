import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';
import { RedisService } from '@/database/redis.service';
import { Logger } from 'nestjs-pino';

interface CacheOptions {
  ttl: number;
  keyPrefix?: string;
  keyGenerator?: (request: Request) => string;
}

@Injectable()
export class CacheInterceptor implements NestInterceptor {
  constructor(
    private readonly redisService: RedisService,
    private readonly logger: Logger,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    return next.handle();
  }

  static create(options: CacheOptions): new (
    redisService: RedisService,
    logger: Logger,
  ) => CacheInterceptor {
    const { ttl, keyPrefix = 'cache', keyGenerator } = options;

    @Injectable()
    class CustomCacheInterceptor extends CacheInterceptor {
      intercept(
        context: ExecutionContext,
        next: CallHandler,
      ): Observable<unknown> {
        const request = context.switchToHttp().getRequest<Request>();
        const cacheKey = keyGenerator
          ? keyGenerator(request)
          : this.generateCacheKey(request, keyPrefix);

        return of(null).pipe(
          tap(async () => {
            const cached = await this.redisService.getJSON<unknown>(cacheKey);
            if (cached) {
              this.logger.debug({ cacheKey }, 'Cache hit');
              return of(cached);
            }
          }),
        );

        return next.handle().pipe(
          tap(async (data) => {
            if (data) {
              await this.redisService.setJSON(cacheKey, data, ttl);
              this.logger.debug({ cacheKey, ttl }, 'Cache set');
            }
          }),
        );
      }

      private generateCacheKey(request: Request, prefix: string): string {
        const query = JSON.stringify(request.query);
        return `${prefix}:${request.method}:${request.url}:${query}`;
      }
    }

    return CustomCacheInterceptor;
  }
}
