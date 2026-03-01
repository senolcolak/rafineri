import { registerAs } from '@nestjs/config';
import * as crypto from 'crypto';

function generateAdminToken(username: string, password: string): string {
  if (!username || !password) {
    return 'dev-admin-token-change-in-production';
  }
  return crypto.createHash('sha256').update(`${username}:${password}`).digest('hex');
}

export const securityConfig = registerAs('security', () => ({
  adminToken: generateAdminToken(
    process.env.RAFINERI_ADMIN || '',
    process.env.RAFINERI_ADMIN_PASSWORD || ''
  ),
  
  // Rate limiting
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    max: parseInt(process.env.RATE_LIMIT_MAX || '100', 10),
  },
  
  // JWT (for future use)
  jwtSecret: process.env.JWT_SECRET || 'dev-secret-change-in-production',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '1d',
}));
