import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Logger } from 'nestjs-pino';
import { Request } from 'express';

@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: Logger) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const startTime = Date.now();
    const handlerName = context.getHandler().name;
    const controllerName = context.getClass().name;

    this.logger.debug(
      {
        method: request.method,
        path: request.url,
        controller: controllerName,
        handler: handlerName,
      },
      `→ ${request.method} ${request.url}`,
    );

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - startTime;
          this.logger.debug(
            {
              method: request.method,
              path: request.url,
              duration: `${duration}ms`,
            },
            `← ${request.method} ${request.url} - ${duration}ms`,
          );
        },
        error: (error) => {
          const duration = Date.now() - startTime;
          this.logger.warn(
            {
              method: request.method,
              path: request.url,
              duration: `${duration}ms`,
              error: error.message,
            },
            `✖ ${request.method} ${request.url} - ${duration}ms - ${error.message}`,
          );
        },
      }),
    );
  }
}
