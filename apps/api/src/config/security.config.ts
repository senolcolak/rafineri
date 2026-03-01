import { registerAs } from '@nestjs/config';

export const securityConfig = registerAs('security', () => ({
  adminToken: process.env.ADMIN_TOKEN || 'dev-admin-token-change-in-production',
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  
  // JWT (for future use)
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
}));
