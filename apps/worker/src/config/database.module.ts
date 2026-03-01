import { Module, Global } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import * as schema from '../database/schema';

export const DATABASE_PROVIDER = 'DATABASE_PROVIDER';
export type Database = NodePgDatabase<typeof schema>;

@Global()
@Module({
  providers: [
    {
      provide: DATABASE_PROVIDER,
      inject: [ConfigService],
      useFactory: async (configService: ConfigService): Promise<Database> => {
        const host = configService.get<string>('database.host');
        const port = configService.get<number>('database.port');
        const user = configService.get<string>('database.username');
        const password = configService.get<string>('database.password');
        const database = configService.get<string>('database.database');
        const ssl = configService.get<boolean>('database.ssl');
        const maxConnections = configService.get<number>('database.maxConnections');
        const connectionTimeout = configService.get<number>('database.connectionTimeout');

        const pool = new Pool({
          host,
          port,
          user,
          password,
          database,
          ssl: ssl ? { rejectUnauthorized: false } : false,
          max: maxConnections,
          connectionTimeoutMillis: connectionTimeout,
        });

        // Test connection
        const client = await pool.connect();
        try {
          const result = await client.query('SELECT NOW()');
          console.log(`✅ Database connected successfully at ${result.rows[0].now}`);
        } finally {
          client.release();
        }

        return drizzle(pool, { schema });
      },
    },
  ],
  exports: [DATABASE_PROVIDER],
})
export class DatabaseModule {}
