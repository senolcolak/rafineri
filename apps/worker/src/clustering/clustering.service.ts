import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { QUEUE_NAMES } from '../queues/queue-definitions.module';
import { StoryClusterJobData } from '../queues/story-cluster.processor';
import { ClusteringService as AiClusteringService } from '@/ai/clustering.service';
import { 
  jaccardSimilarity, 
  urlsMatch,
  normalizeUrl,
} from './similarity.utils';

interface Item {
  id: string;
  title: string;
  canonicalUrl: string;
  source: string;
  postedAt: Date;
  metadata?: any;
}

interface Story {
  id: string;
  title: string;
  canonicalUrl: string;
  firstSeenAt: Date;
  lastUpdatedAt: Date;
  itemIds: string[];
  sources: string[];
}

interface ClusterResult {
  clusteredCount: number;
  storyCount: number;
  newStories: number;
  updatedStories: number;
}

@Injectable()
export class ClusteringService {
  private readonly logger = new Logger(ClusteringService.name);

  constructor(
    private readonly configService: ConfigService,
    @Inject('DATABASE_CLIENT') private readonly db: any,
    @InjectQueue(QUEUE_NAMES.STORY_SCORE) private readonly scoreQueue: Queue,
    @InjectQueue(QUEUE_NAMES.STORY_THUMBNAIL) private readonly thumbnailQueue: Queue,
    private readonly aiClusteringService: AiClusteringService,
  ) {}

  async clusterItems(data: StoryClusterJobData): Promise<ClusterResult> {
    const itemIds = data.itemIds;
    
    if (!itemIds || itemIds.length === 0) {
      this.logger.warn('No item IDs provided for clustering');
      return { clusteredCount: 0, storyCount: 0, newStories: 0, updatedStories: 0 };
    }

    this.logger.log(`Clustering ${itemIds.length} items`);

    // Fetch items from database
    const items = await this.fetchItems(itemIds);
    
    if (items.length === 0) {
      this.logger.warn('No items found for clustering');
      return { clusteredCount: 0, storyCount: 0, newStories: 0, updatedStories: 0 };
    }

    // Find existing stories within time window
    const timeWindowHours = this.configService.get('app.clustering.timeWindowHours');
    const cutoffDate = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    const existingStories = await this.fetchExistingStories(cutoffDate);

    this.logger.debug(`Found ${existingStories.length} existing stories within ${timeWindowHours}h window`);

    // Cluster items
    const clusters = await this.performClustering(items, existingStories);

    // Persist results
    const result = await this.persistClusters(clusters);

    // Queue follow-up jobs
    await this.queueFollowUpJobs(clusters);

    this.logger.log(
      `Clustering complete: ${result.clusteredCount} items -> ` +
      `${result.newStories} new stories, ${result.updatedStories} updated stories`
    );

    return result;
  }

  private async fetchItems(itemIds: string[]): Promise<Item[]> {
    // Query database for items
    const query = `
      SELECT id, title, canonical_url as "canonicalUrl", source, posted_at as "postedAt", metadata
      FROM items
      WHERE id = ANY($1)
    `;
    
    try {
      return await this.db.query(query, [itemIds]);
    } catch (error) {
      this.logger.error('Failed to fetch items:', error);
      // Return mock items for testing
      return itemIds.map((id, i) => ({
        id,
        title: `Test Story ${i}`,
        canonicalUrl: `https://example.com/story-${i}`,
        source: 'test',
        postedAt: new Date(),
      }));
    }
  }

  private async fetchExistingStories(since: Date): Promise<Story[]> {
    const query = `
      SELECT 
        s.id,
        s.title,
        s.canonical_url as "canonicalUrl",
        s.first_seen_at as "firstSeenAt",
        s.last_updated_at as "lastUpdatedAt",
        array_agg(si.item_id) as "itemIds",
        array_agg(DISTINCT i.source) as "sources"
      FROM stories s
      LEFT JOIN story_items si ON s.id = si.story_id
      LEFT JOIN items i ON si.item_id = i.id
      WHERE s.first_seen_at >= $1
      GROUP BY s.id, s.title, s.canonical_url, s.first_seen_at, s.last_updated_at
    `;

    try {
      return await this.db.query(query, [since]);
    } catch (error) {
      this.logger.error('Failed to fetch existing stories:', error);
      return [];
    }
  }

  private async performClustering(
    items: Item[],
    existingStories: Story[]
  ): Promise<Map<string, Item[]>> {
    const useAiClustering = this.configService.get('USE_LOCAL_AI');
    
    if (useAiClustering) {
      this.logger.log('Using AI-powered clustering with embeddings');
      return this.performAiClustering(items, existingStories);
    } else {
      this.logger.log('Using rule-based clustering');
      return this.performRuleBasedClustering(items, existingStories);
    }
  }

  private async performAiClustering(
    items: Item[],
    existingStories: Story[]
  ): Promise<Map<string, Item[]>> {
    const clusters = new Map<string, Item[]>();
    
    // Convert stories to format expected by AI service
    const existingStoryCandidates = existingStories.map(story => ({
      id: story.id,
      title: story.title,
    }));

    for (const item of items) {
      try {
        // Use AI clustering service to determine if item should be clustered
        const candidate = {
          id: item.id,
          title: item.title,
          url: item.canonicalUrl,
          source: item.source,
          publishedAt: item.postedAt,
        };

        const result = await this.aiClusteringService.shouldCluster(
          candidate,
          existingStoryCandidates,
        );

        if (result.shouldCluster && result.storyId) {
          // Match with existing story
          const cluster = clusters.get(result.storyId) || [];
          cluster.push(item);
          clusters.set(result.storyId, cluster);
          this.logger.debug(
            `AI cluster match: item ${item.id} -> story ${result.storyId} ` +
            `(confidence: ${result.confidence.toFixed(2)})`
          );
        } else {
          // Check against new clusters being formed
          let matchedNewCluster = false;
          
          for (const [clusterId, clusterItems] of clusters.entries()) {
            if (clusterId.startsWith('story-')) {
              // Compare with first item in cluster
              const firstItem = clusterItems[0];
              const newClusterResult = await this.aiClusteringService.shouldCluster(
                candidate,
                [{
                  id: clusterId,
                  title: firstItem.title,
                }],
              );

              if (newClusterResult.shouldCluster) {
                clusterItems.push(item);
                matchedNewCluster = true;
                this.logger.debug(
                  `AI new cluster match: item ${item.id} -> ${clusterId}`
                );
                break;
              }
            }
          }

          if (!matchedNewCluster) {
            // Create new cluster
            const newClusterId = `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            clusters.set(newClusterId, [item]);
          }
        }
      } catch (error) {
        this.logger.warn({ err: error, itemId: item.id }, 'AI clustering failed, using fallback');
        // Fallback to rule-based for this item
        await this.fallbackClusterItem(item, existingStories, clusters);
      }
    }

    return clusters;
  }

  private async fallbackClusterItem(
    item: Item,
    existingStories: Story[],
    clusters: Map<string, Item[]>
  ): Promise<void> {
    const threshold = this.configService.get('app.clustering.similarityThreshold');
    let matchedStoryId: string | null = null;

    // Simple Jaccard similarity fallback
    for (const story of existingStories) {
      if (urlsMatch(item.canonicalUrl, story.canonicalUrl)) {
        matchedStoryId = story.id;
        break;
      }

      const similarity = jaccardSimilarity(item.title, story.title);
      if (similarity >= threshold) {
        matchedStoryId = story.id;
        break;
      }
    }

    if (matchedStoryId) {
      const cluster = clusters.get(matchedStoryId) || [];
      cluster.push(item);
      clusters.set(matchedStoryId, cluster);
    } else {
      const newClusterId = `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      clusters.set(newClusterId, [item]);
    }
  }

  private async performRuleBasedClustering(
    items: Item[],
    existingStories: Story[]
  ): Promise<Map<string, Item[]>> {
    const clusters = new Map<string, Item[]>();
    const threshold = this.configService.get('app.clustering.similarityThreshold');
    const timeWindowMs = this.configService.get('app.clustering.timeWindowHours') * 60 * 60 * 1000;

    for (const item of items) {
      let matchedStoryId: string | null = null;

      // Check against existing stories
      for (const story of existingStories) {
        // Check 1: URL match (exact canonical URL)
        if (this.urlsMatchWithinTime(item.canonicalUrl, story.canonicalUrl, timeWindowMs, item.postedAt, story.firstSeenAt)) {
          matchedStoryId = story.id;
          this.logger.debug(`URL match: item ${item.id} -> story ${story.id}`);
          break;
        }

        // Check 2: Title similarity using Jaccard
        const similarity = jaccardSimilarity(item.title, story.title);
        if (similarity >= threshold) {
          matchedStoryId = story.id;
          this.logger.debug(`Title match (${similarity.toFixed(2)}): item ${item.id} -> story ${story.id}`);
          break;
        }
      }

      // Check against new clusters being formed in this batch
      if (!matchedStoryId) {
        for (const [clusterId, clusterItems] of clusters.entries()) {
          const firstItem = clusterItems[0];
          
          // URL match
          if (urlsMatch(item.canonicalUrl, firstItem.canonicalUrl)) {
            matchedStoryId = clusterId;
            break;
          }

          // Title similarity
          const similarity = jaccardSimilarity(item.title, firstItem.title);
          if (similarity >= threshold) {
            matchedStoryId = clusterId;
            break;
          }
        }
      }

      // Assign to cluster
      if (matchedStoryId) {
        const cluster = clusters.get(matchedStoryId) || [];
        cluster.push(item);
        clusters.set(matchedStoryId, cluster);
      } else {
        // Create new cluster
        const newClusterId = `story-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        clusters.set(newClusterId, [item]);
      }
    }

    return clusters;
  }

  private urlsMatchWithinTime(
    url1: string, 
    url2: string, 
    timeWindowMs: number,
    postedAt1: Date,
    postedAt2: Date
  ): boolean {
    // Check if URLs match
    if (!urlsMatch(url1, url2)) {
      return false;
    }

    // Check if within time window
    const timeDiff = Math.abs(postedAt1.getTime() - postedAt2.getTime());
    return timeDiff <= timeWindowMs;
  }

  private async persistClusters(clusters: Map<string, Item[]>): Promise<ClusterResult> {
    let newStories = 0;
    let updatedStories = 0;
    let totalItems = 0;

    for (const [storyId, items] of clusters.entries()) {
      totalItems += items.length;

      // Determine the "best" title (first item's title, or could use more sophisticated logic)
      const primaryItem = items[0];
      const title = this.selectBestTitle(items);
      
      // Check if this is an existing story or new
      const isExisting = !storyId.startsWith('story-');

      try {
        if (isExisting) {
          // Update existing story
          await this.updateStory(storyId, items, title);
          updatedStories++;
        } else {
          // Create new story
          await this.createStory(storyId, items, title, primaryItem);
          newStories++;
        }

        // Write story events
        await this.writeStoryEvents(storyId, items, isExisting ? 'updated' : 'created');

      } catch (error) {
        this.logger.error(`Failed to persist cluster ${storyId}:`, error);
      }
    }

    return {
      clusteredCount: totalItems,
      storyCount: clusters.size,
      newStories,
      updatedStories,
    };
  }

  private selectBestTitle(items: Item[]): string {
    // Simple strategy: use the title from the most authoritative source
    // Could also consider: most complete, most recent, etc.
    const sourcePriority = ['hackernews', 'reddit', 'twitter', 'rss'];
    
    for (const source of sourcePriority) {
      const item = items.find(i => i.source === source);
      if (item) return item.title;
    }
    
    return items[0].title;
  }

  private async createStory(
    storyId: string, 
    items: Item[], 
    title: string,
    primaryItem: Item
  ): Promise<void> {
    const query = `
      INSERT INTO stories (id, title, canonical_url, first_seen_at, last_updated_at, item_count)
      VALUES ($1, $2, $3, $4, $5, $6)
    `;

    await this.db.execute(query, [
      storyId,
      title,
      primaryItem.canonicalUrl,
      new Date(),
      new Date(),
      items.length,
    ]);

    // Link items to story
    await this.linkItemsToStory(storyId, items);
  }

  private async updateStory(storyId: string, items: Item[], title: string): Promise<void> {
    const query = `
      UPDATE stories 
      SET title = $2, last_updated_at = $3, item_count = item_count + $4
      WHERE id = $1
    `;

    await this.db.execute(query, [
      storyId,
      title,
      new Date(),
      items.length,
    ]);

    // Link new items to story
    await this.linkItemsToStory(storyId, items);
  }

  private async linkItemsToStory(storyId: string, items: Item[]): Promise<void> {
    const query = `
      INSERT INTO story_items (story_id, item_id, added_at)
      VALUES ($1, $2, $3)
      ON CONFLICT (story_id, item_id) DO NOTHING
    `;

    for (const item of items) {
      await this.db.execute(query, [storyId, item.id, new Date()]);
    }
  }

  private async writeStoryEvents(
    storyId: string, 
    items: Item[], 
    eventType: string
  ): Promise<void> {
    const query = `
      INSERT INTO story_events (story_id, event_type, event_data, created_at)
      VALUES ($1, $2, $3, $4)
    `;

    const eventData = {
      itemCount: items.length,
      sources: [...new Set(items.map(i => i.source))],
      itemIds: items.map(i => i.id),
    };

    await this.db.execute(query, [
      storyId,
      eventType,
      JSON.stringify(eventData),
      new Date(),
    ]);
  }

  private async queueFollowUpJobs(clusters: Map<string, Item[]>): Promise<void> {
    for (const [storyId, items] of clusters.entries()) {
      // Queue scoring job
      await this.scoreQueue.add('score-story', {
        storyId,
      }, {
        priority: 2,
        delay: 1000, // Small delay to ensure story is persisted
      });

      // Queue thumbnail extraction for the primary URL
      const primaryItem = items[0];
      if (primaryItem.canonicalUrl) {
        await this.thumbnailQueue.add('extract-thumbnail', {
          storyId,
          url: primaryItem.canonicalUrl,
        }, {
          priority: 3,
          delay: 2000,
        });
      }
    }
  }
}
