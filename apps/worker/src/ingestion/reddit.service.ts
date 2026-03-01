import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues/queue-definitions.module';
import { RedditIngestJobData } from '../queues/reddit-ingest.processor';

interface RedditAccessToken {
  access_token: string;
  token_type: string;
  expires_in: number;
  scope: string;
}

interface RedditPost {
  data: {
    id: string;
    title: string;
    url?: string;
    permalink: string;
    author: string;
    created_utc: number;
    score: number;
    num_comments: number;
    subreddit: string;
    selftext?: string;
    is_self: boolean;
  };
}

interface RedditListing {
  data: {
    children: RedditPost[];
    after: string | null;
    before: string | null;
  };
}

export interface IngestResult {
  skipped: boolean;
  reason?: string;
  ingestedCount?: number;
  itemIds?: string[];
}

@Injectable()
export class RedditService {
  private readonly logger = new Logger(RedditService.name);
  private accessToken: string | null = null;
  private tokenExpiry: Date | null = null;

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.STORY_CLUSTER) private readonly clusterQueue: Queue,
  ) {}

  async ingest(data: RedditIngestJobData): Promise<IngestResult> {
    // Check if credentials are available
    if (!this.hasCredentials()) {
      this.logger.warn('Reddit credentials not configured, skipping ingestion');
      return {
        skipped: true,
        reason: 'Missing Reddit API credentials',
      };
    }

    const subreddits = data.subreddits || this.configService.get('app.reddit.subreddits');
    const limit = data.limit || this.configService.get('app.reddit.limit');

    this.logger.log(`Fetching posts from subreddits: ${subreddits.join(', ')}`);

    const allItems: any[] = [];

    for (const subreddit of subreddits) {
      try {
        const posts = await this.fetchSubredditPosts(subreddit, limit);
        const items = posts.map(post => this.transformPost(post));
        allItems.push(...items);
      } catch (error) {
        this.logger.warn(`Failed to fetch from r/${subreddit}:`, error.message);
        // Continue with other subreddits
      }
    }

    // Store items
    const storedItems = await this.storeItems(allItems);

    // Queue clustering job
    if (storedItems.length > 0) {
      await this.clusterQueue.add('cluster-reddit-items', {
        itemIds: storedItems.map(item => item.id),
      }, {
        priority: 1,
      });
    }

    this.logger.log(`Ingested ${storedItems.length} Reddit items`);

    return {
      skipped: false,
      ingestedCount: storedItems.length,
      itemIds: storedItems.map(item => item.id),
    };
  }

  private hasCredentials(): boolean {
    const clientId = this.configService.get('app.reddit.clientId');
    const clientSecret = this.configService.get('app.reddit.clientSecret');
    return !!(clientId && clientSecret);
  }

  private async ensureAuthenticated(): Promise<void> {
    if (this.accessToken && this.tokenExpiry && this.tokenExpiry > new Date()) {
      return;
    }

    await this.authenticate();
  }

  private async authenticate(): Promise<void> {
    const clientId = this.configService.get('app.reddit.clientId');
    const clientSecret = this.configService.get('app.reddit.clientSecret');
    const username = this.configService.get('app.reddit.username');
    const password = this.configService.get('app.reddit.password');
    const userAgent = this.configService.get('app.reddit.userAgent');

    const authString = Buffer.from(`${clientId}:${clientSecret}`).toString('base64');

    try {
      const response = await fetch(this.configService.get('app.reddit.authUrl'), {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${authString}`,
          'User-Agent': userAgent,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: new URLSearchParams({
          grant_type: username && password ? 'password' : 'client_credentials',
          ...(username && { username }),
          ...(password && { password }),
        }),
      });

      if (!response.ok) {
        throw new Error(`Reddit auth error: ${response.status}`);
      }

      const tokenData: RedditAccessToken = await response.json();
      this.accessToken = tokenData.access_token;
      this.tokenExpiry = new Date(Date.now() + (tokenData.expires_in - 60) * 1000);

      this.logger.debug('Reddit authentication successful');
    } catch (error) {
      this.logger.error('Reddit authentication failed:', error);
      throw error;
    }
  }

  private async fetchSubredditPosts(subreddit: string, limit: number): Promise<RedditPost[]> {
    await this.ensureAuthenticated();

    const url = `${this.configService.get('app.reddit.baseUrl')}/r/${subreddit}/hot?limit=${limit}`;
    const userAgent = this.configService.get('app.reddit.userAgent');

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${this.accessToken}`,
        'User-Agent': userAgent,
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, clear and retry once
        this.accessToken = null;
        await this.ensureAuthenticated();
        return this.fetchSubredditPosts(subreddit, limit);
      }
      throw new Error(`Reddit API error: ${response.status}`);
    }

    const listing: RedditListing = await response.json();
    return listing.data.children;
  }

  private transformPost(post: RedditPost): any {
    const data = post.data;
    const url = data.is_self 
      ? `https://reddit.com${data.permalink}` 
      : data.url || `https://reddit.com${data.permalink}`;

    return {
      externalId: `reddit:${data.id}`,
      source: 'reddit',
      title: this.cleanTitle(data.title),
      url: url,
      canonicalUrl: this.canonicalizeUrl(url),
      author: data.author,
      postedAt: new Date(data.created_utc * 1000),
      metadata: {
        score: data.score,
        comments: data.num_comments,
        subreddit: data.subreddit,
        selftext: data.selftext,
      },
    };
  }

  private cleanTitle(title: string): string {
    return title
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 300);
  }

  private canonicalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      
      // Remove tracking parameters
      const trackingParams = [
        'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
        'gclid', 'fbclid', 'ref',
      ];
      
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });
      
      if (urlObj.searchParams.toString() === '') {
        urlObj.search = '';
      }
      
      if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }
      
      // Remove Reddit-specific tracking
      if (urlObj.hostname.includes('reddit.com')) {
        // Keep the essential path only
        const match = urlObj.pathname.match(/\/r\/[^/]+\/comments\/[^/]+/);
        if (match) {
          urlObj.pathname = match[0];
        }
      }
      
      urlObj.hash = '';
      
      return urlObj.toString().toLowerCase();
    } catch (error) {
      this.logger.warn(`Failed to canonicalize URL: ${url}`);
      return url.toLowerCase();
    }
  }

  private async storeItems(items: any[]): Promise<{ id: string; canonicalUrl: string }[]> {
    this.logger.debug(`Storing ${items.length} Reddit items`);
    
    return items.map((item, index) => ({
      id: `item-${Date.now()}-${index}`,
      canonicalUrl: item.canonicalUrl,
    }));
  }
}
