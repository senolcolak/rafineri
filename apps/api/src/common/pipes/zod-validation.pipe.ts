import {
  PipeTransform,
  Injectable,
  BadRequestException,
  ArgumentMetadata,
} from '@nestjs/common';
import { ZodSchema, ZodError } from 'zod';
import { Logger } from 'nestjs-pino';

@Injectable()
export class ZodValidationPipe implements PipeTransform {
  constructor(
    private readonly schema: ZodSchema<unknown>,
    private readonly logger: Logger,
  ) {}

  transform(value: unknown, metadata: ArgumentMetadata): unknown {
    // Skip validation for non-body parameters if needed
    if (metadata.type !== 'body' && metadata.type !== 'query') {
      return value;
    }

    try {
      const parsed = this.schema.parse(value);
      return parsed;
    } catch (error) {
      if (error instanceof ZodError) {
        const formattedErrors = error.errors.map((e) => ({
          path: e.path.join('.'),
          message: e.message,
        }));

        this.logger.debug(
          { errors: formattedErrors, type: metadata.type },
          'Validation failed',
        );

        throw new BadRequestException({
          message: 'Validation failed',
          errors: formattedErrors,
        });
      }

      throw error;
    }
  }
}
