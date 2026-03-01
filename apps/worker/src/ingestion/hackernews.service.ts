import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues/queue-definitions.module';
import { HNIngestJobData } from '../queues/hn-ingest.processor';

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
  ) {}

  async ingest(data: HNIngestJobData): Promise<{ ingestedCount: number; itemIds: string[] }> {
    const batchSize = data.batchSize || this.configService.get('app.hn.batchSize');
    
    // Fetch top story IDs
    const storyIds = data.storyIds || await this.fetchTopStoryIds();
    const batch = storyIds.slice(0, batchSize);
    
    this.logger.log(`Fetching ${batch.length} HN stories`);

    // Fetch items in parallel with concurrency limit
    const concurrency = this.configService.get('app.hn.concurrency');
    const items: IngestedItem[] = [];
    
    for (let i = 0; i < batch.length; i += concurrency) {
      const chunk = batch.slice(i, i + concurrency);
      const chunkItems = await Promise.all(
        chunk.map(id => this.fetchItem(id))
      );
      items.push(...chunkItems.filter(Boolean));
    }

    // Store items and queue for clustering
    const storedItems = await this.storeItems(items);
    
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
      this.logger.warn(`Failed to fetch HN item ${id}:`, error.message);
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

  private async storeItems(items: IngestedItem[]): Promise<{ id: string; canonicalUrl: string }[]> {
    // This would store in database and return the stored item IDs
    // For now, return mock IDs
    this.logger.debug(`Storing ${items.length} items`);
    
    return items.map((item, index) => ({
      id: `item-${Date.now()}-${index}`,
      canonicalUrl: item.canonicalUrl,
    }));
  }
}
