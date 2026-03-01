import { registerAs } from '@nestjs/config';

export default registerAs('app', () => ({
  nodeEnv: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT, 10) || 3000,
  mockMode: process.env.MOCK_MODE === 'true',
  hn: {
    topStoriesUrl: 'https://hacker-news.firebaseio.com/v0/topstories.json',
    itemUrl: (id: number) => `https://hacker-news.firebaseio.com/v0/item/${id}.json`,
    concurrency: parseInt(process.env.HN_CONCURRENCY, 10) || 5,
    batchSize: parseInt(process.env.HN_BATCH_SIZE, 10) || 30,
  },
  reddit: {
    baseUrl: 'https://oauth.reddit.com',
    authUrl: 'https://www.reddit.com/api/v1/access_token',
    subreddits: (process.env.REDDIT_SUBREDDITS || 'technology,science,worldnews').split(','),
    limit: parseInt(process.env.REDDIT_LIMIT, 10) || 25,
    clientId: process.env.REDDIT_CLIENT_ID,
    clientSecret: process.env.REDDIT_CLIENT_SECRET,
    username: process.env.REDDIT_USERNAME,
    password: process.env.REDDIT_PASSWORD,
    userAgent: process.env.REDDIT_USER_AGENT || 'RafineriWorker/1.0',
  },
  thumbnail: {
    timeout: parseInt(process.env.THUMBNAIL_TIMEOUT, 10) || 5000,
    placeholderUrl: process.env.THUMBNAIL_PLACEHOLDER || 'https://via.placeholder.com/120x80?text=No+Image',
    maxRedirects: parseInt(process.env.THUMBNAIL_MAX_REDIRECTS, 10) || 3,
  },
  clustering: {
    similarityThreshold: parseFloat(process.env.CLUSTERING_SIMILARITY_THRESHOLD) || 0.75,
    timeWindowHours: parseInt(process.env.CLUSTERING_TIME_WINDOW_HOURS, 10) || 48,
  },
}));
