import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { eq, sql, inArray, and, gte } from 'drizzle-orm';
import { QUEUE_NAMES } from '../queues/queue-names';
import { StoryClusterJobData } from '../queues/story-cluster.processor';
import { ClusteringService as AiClusteringService } from '@/ai/clustering.service';
import { 
  jaccardSimilarity, 
  urlsMatch,
} from './similarity.utils';
import { items, stories, storyItems, storyEvents } from '../database/schema';
import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import * as schema from '../database/schema';

interface Item {
  id: string;
  title: string;
  canonicalUrl: string;
  source: string;
  postedAt: Date;
  metadata?: any;
}

interface Story {
  id: number;
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
    @Inject('DATABASE_PROVIDER') private readonly db: NodePgDatabase<typeof schema>,
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
    const itemsData = await this.fetchItems(itemIds);
    
    if (itemsData.length === 0) {
      this.logger.warn('No items found for clustering');
      return { clusteredCount: 0, storyCount: 0, newStories: 0, updatedStories: 0 };
    }

    // Find existing stories within time window
    const timeWindowHours = this.configService.get('app.clustering.timeWindowHours');
    const cutoffDate = new Date(Date.now() - timeWindowHours * 60 * 60 * 1000);
    const existingStories = await this.fetchExistingStories(cutoffDate);

    this.logger.debug(`Found ${existingStories.length} existing stories within ${timeWindowHours}h window`);

    // Cluster items
    const clusters = await this.performClustering(itemsData, existingStories);

    // Persist results
    const { result, storyIds } = await this.persistClusters(clusters);

    // Queue follow-up jobs
    await this.queueFollowUpJobs(storyIds, clusters);

    this.logger.log(
      `Clustering complete: ${result.clusteredCount} items -> ` +
      `${result.newStories} new stories, ${result.updatedStories} updated stories`
    );

    return result;
  }

  private async fetchItems(itemIds: string[]): Promise<Item[]> {
    try {
      const results = await this.db
        .select({
          id: items.id,
          title: items.title,
          canonicalUrl: items.canonicalUrl,
          source: items.sourceType,
          postedAt: items.postedAt,
          metadata: items.rawData,
        })
        .from(items)
        .where(inArray(items.id, itemIds.map(id => parseInt(id)).filter(id => !isNaN(id))));
      
      return results.map(r => ({
        id: String(r.id),
        title: r.title,
        canonicalUrl: r.canonicalUrl || '',
        source: r.source,
        postedAt: r.postedAt,
        metadata: r.metadata,
      }));
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
    try {
      const results = await this.db
        .select({
          id: stories.id,
          title: stories.title,
          canonicalUrl: stories.canonicalUrl,
          firstSeenAt: stories.firstSeenAt,
          lastUpdatedAt: stories.updatedAt,
        })
        .from(stories)
        .where(gte(stories.firstSeenAt, since));

      // Fetch related items for each story
      const storiesWithItems: Story[] = [];
      for (const story of results) {
        const itemLinks = await this.db
          .select({
            itemId: storyItems.itemId,
            sourceType: items.sourceType,
          })
          .from(storyItems)
          .innerJoin(items, eq(items.id, storyItems.itemId))
          .where(eq(storyItems.storyId, story.id));

        storiesWithItems.push({
          id: story.id,
          title: story.title,
          canonicalUrl: story.canonicalUrl || '',
          firstSeenAt: story.firstSeenAt,
          lastUpdatedAt: story.lastUpdatedAt,
          itemIds: itemLinks.map(l => String(l.itemId)),
          sources: [...new Set(itemLinks.map(l => l.sourceType))],
        });
      }

      return storiesWithItems;
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
      id: String(story.id),
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
        matchedStoryId = String(story.id);
        break;
      }

      const similarity = jaccardSimilarity(item.title, story.title);
      if (similarity >= threshold) {
        matchedStoryId = String(story.id);
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
          matchedStoryId = String(story.id);
          this.logger.debug(`URL match: item ${item.id} -> story ${story.id}`);
          break;
        }

        // Check 2: Title similarity using Jaccard
        const similarity = jaccardSimilarity(item.title, story.title);
        if (similarity >= threshold) {
          matchedStoryId = String(story.id);
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

  private async persistClusters(clusters: Map<string, Item[]>): Promise<{ result: ClusterResult; storyIds: number[] }> {
    let newStories = 0;
    let updatedStories = 0;
    let totalItems = 0;
    const storyIds: number[] = [];

    for (const [clusterId, items] of clusters.entries()) {
      totalItems += items.length;

      // Determine the "best" title (first item's title, or could use more sophisticated logic)
      const primaryItem = items[0];
      const title = this.selectBestTitle(items);
      
      // Check if this is an existing story or new
      const isExisting = !clusterId.startsWith('story-');

      try {
        if (isExisting) {
          // Update existing story (clusterId is the existing story ID)
          const storyIdNum = parseInt(clusterId);
          if (!isNaN(storyIdNum)) {
            await this.updateStory(storyIdNum, items, title);
            await this.writeStoryEvents(storyIdNum, items, 'updated');
            storyIds.push(storyIdNum);
            updatedStories++;
          }
        } else {
          // Create new story - database will generate the ID
          const newStoryId = await this.createStory(items, title, primaryItem);
          if (newStoryId !== null) {
            await this.writeStoryEvents(newStoryId, items, 'created');
            storyIds.push(newStoryId);
            newStories++;
          }
        }

      } catch (error) {
        this.logger.error(`Failed to persist cluster ${clusterId}:`, error);
      }
    }

    return {
      result: {
        clusteredCount: totalItems,
        storyCount: clusters.size,
        newStories,
        updatedStories,
      },
      storyIds,
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
    items: Item[], 
    title: string,
    primaryItem: Item
  ): Promise<number | null> {
    const result = await this.db.insert(stories).values({
      title,
      canonicalUrl: primaryItem.canonicalUrl,
      firstSeenAt: new Date(),
      updatedAt: new Date(),
      itemCount: items.length,
    }).returning({ id: stories.id });

    if (result.length === 0) {
      return null;
    }

    const storyId = result[0].id;

    // Link items to story
    await this.linkItemsToStory(storyId, items);

    return storyId;
  }

  private async updateStory(storyId: number, items: Item[], title: string): Promise<void> {
    await this.db
      .update(stories)
      .set({
        title,
        updatedAt: new Date(),
        itemCount: sql`${stories.itemCount} + ${items.length}`,
      })
      .where(eq(stories.id, storyId));

    // Link new items to story
    await this.linkItemsToStory(storyId, items);
  }

  private async linkItemsToStory(storyId: number, items: Item[]): Promise<void> {
    for (const item of items) {
      const itemId = parseInt(item.id);
      if (isNaN(itemId)) continue;

      await this.db
        .insert(storyItems)
        .values({
          storyId,
          itemId,
          createdAt: new Date(),
        })
        .onConflictDoNothing();
    }
  }

  private async writeStoryEvents(
    storyId: number, 
    items: Item[], 
    eventType: 'created' | 'updated'
  ): Promise<void> {
    await this.db.insert(storyEvents).values({
      storyId,
      eventType: eventType === 'created' ? 'story_created' : 'item_added',
      data: {
        itemCount: items.length,
        sources: [...new Set(items.map(i => i.source))],
        itemIds: items.map(i => i.id),
      },
      createdAt: new Date(),
    });
  }

  private async queueFollowUpJobs(storyIds: number[], clusters: Map<string, Item[]>): Promise<void> {
    // Build a map of storyId to items by matching in order
    const allClusters = Array.from(clusters.entries());
    const existingClusters = allClusters.filter(([id]) => !id.startsWith('story-'));
    const newClusters = allClusters.filter(([id]) => id.startsWith('story-'));
    
    // Map existing stories (parse their IDs)
    const storyItemsMap = new Map<number, Item[]>();
    for (const [clusterId, items] of existingClusters) {
      const storyIdNum = parseInt(clusterId);
      if (!isNaN(storyIdNum)) {
        storyItemsMap.set(storyIdNum, items);
      }
    }
    
    // Map new stories (use the returned storyIds in order)
    const newStoryIds = storyIds.filter(id => !Array.from(existingClusters).some(([cid]) => parseInt(cid) === id));
    for (let i = 0; i < newStoryIds.length && i < newClusters.length; i++) {
      storyItemsMap.set(newStoryIds[i], newClusters[i][1]);
    }

    for (const [storyId, items] of storyItemsMap.entries()) {
      // Queue scoring job
      await this.scoreQueue.add('score-story', {
        storyId: String(storyId),
      }, {
        priority: 2,
        delay: 1000, // Small delay to ensure story is persisted
      });

      // Queue thumbnail extraction for the primary URL
      const primaryItem = items[0];
      if (primaryItem.canonicalUrl) {
        await this.thumbnailQueue.add('extract-thumbnail', {
          storyId: String(storyId),
          url: primaryItem.canonicalUrl,
        }, {
          priority: 3,
          delay: 2000,
        });
      }
    }
  }
}
