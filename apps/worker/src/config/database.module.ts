import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

export interface DatabaseConfig {
  host: string;
  port: number;
  database: string;
  user: string;
  password: string;
}

export interface DatabaseClient {
  query<T = any>(sql: string, params?: any[]): Promise<T[]>;
  execute(sql: string, params?: any[]): Promise<void>;
  transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T>;
}

@Global()
@Module({
  providers: [
    {
      provide: 'DATABASE_CLIENT',
      useFactory: (configService: ConfigService): DatabaseClient => {
        // This is a mock implementation - replace with actual DB client (e.g., pg, mysql2)
        // In production, use TypeORM, Prisma, or raw driver
        const logger = console;
        
        return {
          async query<T = any>(sql: string, params?: any[]): Promise<T[]> {
            logger.log(`[DB QUERY] ${sql}`);
            // Implementation would connect to actual database
            return [] as T[];
          },
          async execute(sql: string, params?: any[]): Promise<void> {
            logger.log(`[DB EXECUTE] ${sql}`);
            // Implementation would connect to actual database
          },
          async transaction<T>(callback: (client: DatabaseClient) => Promise<T>): Promise<T> {
            logger.log('[DB TRANSACTION] Begin');
            try {
              const result = await callback(this);
              logger.log('[DB TRANSACTION] Commit');
              return result;
            } catch (error) {
              logger.error('[DB TRANSACTION] Rollback', error);
              throw error;
            }
          },
        };
      },
      inject: [ConfigService],
    },
  ],
  exports: ['DATABASE_CLIENT'],
})
export class DatabaseModule {}
