import type { Config } from 'drizzle-kit';

export default {
  schema: './apps/api/src/database/schema.ts',
  out: './drizzle',
  driver: 'pg',
  dbCredentials: {
    connectionString: process.env.DATABASE_URL || 'postgresql://rafineri:rafineri@localhost:5432/rafineri',
  },
  verbose: true,
  strict: true,
} satisfies Config;
