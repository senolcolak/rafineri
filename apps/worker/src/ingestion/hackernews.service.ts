import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, sql } from 'drizzle-orm';
import { QUEUE_NAMES } from '../queues/queue-definitions.module';
import { HNIngestJobData } from '../queues/hn-ingest.processor';
import { items } from '../database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';

export interface HNItem {
  id: number;
  title?: string;
  url?: string;
  text?: string;
  by?: string;
  time?: number;
  score?: number;
  descendants?: number;
  type?: string;
  kids?: number[];
}

export interface IngestedItem {
  externalId: string;
  source: string;
  title: string;
  url: string;
  canonicalUrl: string;
  author: string;
  postedAt: Date;
  metadata: {
    score: number;
    comments: number;
    text?: string;
  };
}

@Injectable()
export class HackerNewsService {
  private readonly logger = new Logger(HackerNewsService.name);

  constructor(
    private readonly configService: ConfigService,
    @InjectQueue(QUEUE_NAMES.STORY_CLUSTER) private readonly clusterQueue: Queue,
    @Inject('DATABASE_PROVIDER') private readonly db: NodePgDatabase<typeof schema>,
  ) {}

  async ingest(data: HNIngestJobData): Promise<{ ingestedCount: number; itemIds: string[] }> {
    const batchSize = data.batchSize || this.configService.get('app.hn.batchSize');
    
    // Fetch top story IDs
    const storyIds = data.storyIds || await this.fetchTopStoryIds();
    const batch = storyIds.slice(0, batchSize);
    
    this.logger.log(`Fetching ${batch.length} HN stories`);

    // Fetch items in parallel with concurrency limit
    const concurrency = this.configService.get('app.hn.concurrency');
    const itemsData: IngestedItem[] = [];
    
    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const chunkItems = await Promise.all(
        chunk.map(id => this.fetchItem(id))
      );
      itemsData.push(...chunkItems.filter(Boolean));
    }

    // Store items and queue for clustering
    const storedItems = await this.storeItems(itemsData);
    
    // Queue clustering job
    if (storedItems.length > 0) {
      await this.clusterQueue.add('cluster-hn-items', {
        itemIds: storedItems.map(item => item.id),
      }, {
        priority: 1,
      });
    }

    this.logger.log(`Ingested ${storedItems.length} HN items`);
    
    return {
      ingestedCount: storedItems.length,
      itemIds: storedItems.map(item => item.id),
    };
  }

  private async fetchTopStoryIds(): Promise<number[]> {
    const url = this.configService.get('app.hn.topStoriesUrl');
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HN API error: ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      this.logger.error('Failed to fetch HN top stories:', error);
      throw error;
    }
  }

  private async fetchItem(id: number): Promise<IngestedItem | null> {
    const url = this.configService.get('app.hn.itemUrl')(id);
    
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HN API error: ${response.status}`);
      }
      
      const item: HNItem = await response.json();
      
      // Skip non-story items
      if (item.type !== 'story' || !item.title) {
        return null;
      }

      // Skip job postings and other non-external content
      const url_ = item.url || `https://news.ycombinator.com/item?id=${item.id}`;
      
      return {
        externalId: `hn:${item.id}`,
        source: 'hackernews',
        title: this.cleanTitle(item.title),
        url: url_,
        canonicalUrl: this.canonicalizeUrl(url_),
        author: item.by || 'unknown',
        postedAt: item.time ? new Date(item.time * 1000) : new Date(),
        metadata: {
          score: item.score || 0,
          comments: item.descendants || 0,
          text: item.text,
        },
      };
    } catch (error) {
      this.logger.warn(`Failed to fetch HN item ${id}:`, (error as Error).message);
      return null;
    }
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
        'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
        'gclid', 'gclsrc', 'dclid',
        'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_ref', 'fb_source',
        'ref', 'referrer', 'referral', 'source', 'medium',
        'campaign', 'term', 'content',
        'mc_cid', 'mc_eid',
        '_ga', '_gid', '_gac', '_gl',
        'cid', 'sid', 'hsa_cam', 'hsa_grp', 'hsa_mt', 'hsa_src', 'hsa_ad', 'hsa_acc', 'hsa_net', 'hsa_kw',
        'ttclid', 'wickedid', 'yclid', 'msclkid',
      ];
      
      trackingParams.forEach(param => {
        urlObj.searchParams.delete(param);
      });
      
      // Remove empty search params
      if (urlObj.searchParams.toString() === '') {
        urlObj.search = '';
      }
      
      // Remove trailing slash from pathname (except for root)
      if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
        urlObj.pathname = urlObj.pathname.slice(0, -1);
      }
      
      // Remove fragment unless it's likely meaningful (not tracking)
      const meaningfulFragments = ['section', 'article', 'post', 'comment', 'discussion'];
      const hasMeaningfulFragment = meaningfulFragments.some(f => 
        urlObj.hash.toLowerCase().includes(f)
      );
      if (!hasMeaningfulFragment) {
        urlObj.hash = '';
      }
      
      return urlObj.toString().toLowerCase();
    } catch (error) {
      this.logger.warn(`Failed to canonicalize URL: ${url}`);
      return url.toLowerCase();
    }
  }

  private async storeItems(ingestedItems: IngestedItem[]): Promise<{ id: string; canonicalUrl: string }[]> {
    if (ingestedItems.length === 0) {
      return [];
    }

    this.logger.log(`Storing ${ingestedItems.length} HN items in database`);
    
    const results: { id: string; canonicalUrl: string }[] = [];

    for (const item of ingestedItems) {
      try {
        // Insert or update item using Drizzle ORM
        const result = await this.db
          .insert(items)
          .values({
            sourceType: 'hackernews',
            externalId: item.externalId,
            url: item.url,
            canonicalUrl: item.canonicalUrl,
            title: item.title,
            content: item.metadata.text || null,
            author: item.author,
            score: item.metadata.score,
            postedAt: item.postedAt,
            rawData: item.metadata,
          })
          .onConflictDoUpdate({
            target: [items.sourceType, items.externalId],
            set: {
              title: item.title,
              score: item.metadata.score,
              rawData: item.metadata,
              postedAt: item.postedAt,
              updatedAt: sql`now()`,
            },
          })
          .returning({ id: items.id, canonicalUrl: items.canonicalUrl });

        if (result.length > 0) {
          results.push({
            id: String(result[0].id),
            canonicalUrl: result[0].canonicalUrl || item.canonicalUrl,
          });
          this.logger.debug(`Stored item: ${item.externalId} -> DB ID: ${result[0].id}`);
        }
      } catch (error) {
        this.logger.error(`Failed to store item ${item.externalId}:`, (error as Error).message);
        // Continue with other items even if one fails
      }
    }

    this.logger.log(`Successfully stored ${results.length} items`);
    return results;
  }
}
