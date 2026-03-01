import { registerAs } from '@nestjs/config';

export const redisConfig = registerAs('redis', () => ({
  host: process.env.REDIS_HOST || 'localhost',
  port: parseInt(process.env.REDIS_PORT || '6379', 10),
  password: process.env.REDIS_PASSWORD,
  db: parseInt(process.env.REDIS_DB || '0', 10),
  keyPrefix: process.env.REDIS_KEY_PREFIX || 'rafineri:',
  
  // Cache TTL settings (in seconds)
  cacheTtl: {
    trending: {
      hot: parseInt(process.env.REDIS_CACHE_TTL_HOT || '60', 10),
      mostVerified: parseInt(process.env.REDIS_CACHE_TTL_MOST_VERIFIED || '120', 10),
      mostContested: parseInt(process.env.REDIS_CACHE_TTL_MOST_CONTESTED || '120', 10),
      newest: parseInt(process.env.REDIS_CACHE_TTL_NEWEST || '60', 10),
      default: parseInt(process.env.REDIS_CACHE_TTL_DEFAULT || '180', 10),
    },
    story: parseInt(process.env.REDIS_CACHE_TTL_STORY || '300', 10),
    categories: parseInt(process.env.REDIS_CACHE_TTL_CATEGORIES || '3600', 10),
  },
  
  // Connection options
  maxRetriesPerRequest: 3,
  enableReadyCheck: true,
  lazyConnect: false,
}));
