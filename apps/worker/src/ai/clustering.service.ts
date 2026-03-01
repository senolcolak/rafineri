import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from './ollama.service';

interface StoryCandidate {
  id: string;
  title: string;
  summary?: string;
  content?: string;
  url: string;
  source: string;
  publishedAt: Date;
}

interface ExistingStory {
  id: string;
  title: string;
  summary?: string;
  embeddings?: number[];
}

interface ClusteringResult {
  shouldCluster: boolean;
  storyId?: string;
  confidence: number;
  reasoning: string;
  similarity?: number;
}

interface EmbeddingCache {
  [key: string]: number[];
}

@Injectable()
export class ClusteringService {
  private readonly logger = new Logger(ClusteringService.name);
  private embeddingCache: EmbeddingCache = {};
  private readonly cacheMaxSize = 1000;

  constructor(private readonly ollamaService: OllamaService) {}

  /**
   * Determine if a new item should be clustered with an existing story
   */
  async shouldCluster(
    candidate: StoryCandidate,
    existingStories: ExistingStory[],
  ): Promise<ClusteringResult> {
    try {
      // Fast path: check for exact URL matches
      const urlMatch = this.checkUrlSimilarity(candidate, existingStories);
      if (urlMatch.isMatch) {
        return {
          shouldCluster: true,
          storyId: urlMatch.storyId,
          confidence: 0.95,
          reasoning: 'URL similarity detected',
          similarity: 1.0,
        };
      }

      // Generate embedding for candidate
      const candidateEmbedding = await this.getEmbedding(this.buildTextForEmbedding(candidate));

      // Compare with existing stories
      let bestMatch: { storyId: string; similarity: number } | null = null;

      for (const story of existingStories) {
        let storyEmbedding: number[];

        if (story.embeddings) {
          storyEmbedding = story.embeddings;
        } else {
          storyEmbedding = await this.getEmbedding(this.buildTextForEmbedding(story));
          // Cache for future use
          story.embeddings = storyEmbedding;
        }

        const similarity = this.cosineSimilarity(candidateEmbedding, storyEmbedding);

        if (!bestMatch || similarity > bestMatch.similarity) {
          bestMatch = { storyId: story.id, similarity };
        }
      }

      // Determine clustering threshold
      const threshold = 0.75; // Configurable

      if (bestMatch && bestMatch.similarity >= threshold) {
        return {
          shouldCluster: true,
          storyId: bestMatch.storyId,
          confidence: bestMatch.similarity,
          reasoning: `Semantic similarity: ${(bestMatch.similarity * 100).toFixed(1)}%`,
          similarity: bestMatch.similarity,
        };
      }

      // Use LLM for borderline cases
      if (bestMatch && bestMatch.similarity >= 0.6) {
        const llmResult = await this.llmClusteringCheck(candidate, existingStories);
        if (llmResult.shouldCluster) {
          return {
            ...llmResult,
            similarity: bestMatch.similarity,
          };
        }
      }

      return {
        shouldCluster: false,
        confidence: bestMatch ? 1 - bestMatch.similarity : 1,
        reasoning: bestMatch 
          ? `No strong match found (best: ${(bestMatch.similarity * 100).toFixed(1)}%)`
          : 'No existing stories to compare',
        similarity: bestMatch?.similarity,
      };
    } catch (error) {
      this.logger.error({ err: error }, 'Clustering failed, using fallback');
      return this.fallbackClustering(candidate, existingStories);
    }
  }

  /**
   * Generate embedding for text
   */
  async getEmbedding(text: string): Promise<number[]> {
    // Check cache first
    const cacheKey = this.hashText(text);
    if (this.embeddingCache[cacheKey]) {
      return this.embeddingCache[cacheKey];
    }

    // Generate new embedding
    const embedding = await this.ollamaService.embed(text);

    // Cache with LRU eviction
    if (Object.keys(this.embeddingCache).length >= this.cacheMaxSize) {
      const firstKey = Object.keys(this.embeddingCache)[0];
      delete this.embeddingCache[firstKey];
    }
    this.embeddingCache[cacheKey] = embedding;

    return embedding;
  }

  /**
   * Find duplicate or similar content
   */
  async findDuplicates(
    candidates: StoryCandidate[],
  ): Promise<Array<{ items: string[]; similarity: number }>> {
    const embeddings: Array<{ id: string; embedding: number[] }> = [];

    // Generate embeddings for all candidates
    for (const candidate of candidates) {
      const text = this.buildTextForEmbedding(candidate);
      const embedding = await this.getEmbedding(text);
      embeddings.push({ id: candidate.id, embedding });
    }

    // Find duplicates using similarity matrix
    const duplicates: Array<{ items: string[]; similarity: number }> = [];
    const processed = new Set<string>();

    for (let i = 0; i < embeddings.length; i++) {
      if (processed.has(embeddings[i].id)) continue;

      const group = [embeddings[i].id];
      let maxSimilarity = 1;

      for (let j = i + 1; j < embeddings.length; j++) {
        if (processed.has(embeddings[j].id)) continue;

        const similarity = this.cosineSimilarity(
          embeddings[i].embedding,
          embeddings[j].embedding,
        );

        if (similarity >= 0.85) {
          group.push(embeddings[j].id);
          processed.add(embeddings[j].id);
          maxSimilarity = Math.min(maxSimilarity, similarity);
        }
      }

      if (group.length > 1) {
        duplicates.push({ items: group, similarity: maxSimilarity });
      }

      processed.add(embeddings[i].id);
    }

    return duplicates;
  }

  private checkUrlSimilarity(
    candidate: StoryCandidate,
    stories: ExistingStory[],
  ): { isMatch: boolean; storyId?: string } {
    // Extract canonical URL patterns
    const candidateUrl = this.normalizeUrl(candidate.url);

    // This would need access to the stories' URLs in a real implementation
    // For now, return no match
    return { isMatch: false };
  }

  private normalizeUrl(url: string): string {
    try {
      const urlObj = new URL(url);
      // Remove tracking parameters
      urlObj.searchParams.delete('utm_source');
      urlObj.searchParams.delete('utm_medium');
      urlObj.searchParams.delete('utm_campaign');
      urlObj.searchParams.delete('ref');
      return urlObj.toString().toLowerCase();
    } catch {
      return url.toLowerCase();
    }
  }

  private async llmClusteringCheck(
    candidate: StoryCandidate,
    stories: ExistingStory[],
  ): Promise<ClusteringResult> {
    try {
      const systemPrompt = `You are a news clustering AI. Determine if two stories are about the same topic/event.

Respond in this exact JSON format:
{
  "shouldCluster": true | false,
  "confidence": 0.0-1.0,
  "reasoning": "Brief explanation"
}

Stories should be clustered if they:
- Cover the same news event/topic
- Share key entities (people, organizations, locations)
- Would make sense to read together

Do NOT cluster if they:
- Are just similar topics (e.g., both about AI)
- Are different events involving similar people
- Would confuse readers if combined`;

      // Get top 3 most similar stories for LLM to evaluate
      const topStories = stories.slice(0, 3);
      
      const prompt = `Should this new story be grouped with an existing story?

NEW STORY:
Title: ${candidate.title}
Summary: ${candidate.summary || 'N/A'}

EXISTING STORIES:
${topStories.map((s, i) => `${i + 1}. ${s.title}`).join('\n')}

Respond in JSON format.`;

      const response = await this.ollamaService.generate(prompt, systemPrompt, {
        temperature: 0.1,
        maxTokens: 256,
      });

      const parsed = JSON.parse(response.match(/\{[\s\S]*\}/)?.[0] || '{}');

      return {
        shouldCluster: parsed.shouldCluster || false,
        confidence: parsed.confidence || 0.5,
        reasoning: parsed.reasoning || 'LLM evaluation',
      };
    } catch (error) {
      this.logger.error({ err: error }, 'LLM clustering check failed');
      return { shouldCluster: false, confidence: 0, reasoning: 'LLM check failed' };
    }
  }

  private buildTextForEmbedding(item: { title: string; summary?: string; content?: string }): string {
    const parts = [item.title];
    
    if (item.summary) {
      parts.push(item.summary);
    } else if (item.content) {
      // Use first 500 chars of content if no summary
      parts.push(item.content.substring(0, 500));
    }

    return parts.join('. ');
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      throw new Error('Vectors must have same length');
    }

    let dotProduct = 0;
    let normA = 0;
    let normB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      normA += a[i] * a[i];
      normB += b[i] * b[i];
    }

    if (normA === 0 || normB === 0) {
      return 0;
    }

    return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
  }

  private hashText(text: string): string {
    // Simple hash for cache key
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      const char = text.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    return hash.toString();
  }

  private fallbackClustering(
    candidate: StoryCandidate,
    stories: ExistingStory[],
  ): ClusteringResult {
    // Simple title similarity fallback
    const candidateWords = new Set(candidate.title.toLowerCase().split(' '));
    
    let bestMatch: { storyId: string; score: number } | null = null;

    for (const story of stories) {
      const storyWords = new Set(story.title.toLowerCase().split(' '));
      const intersection = new Set([...candidateWords].filter(x => storyWords.has(x)));
      const union = new Set([...candidateWords, ...storyWords]);
      const jaccard = intersection.size / union.size;

      if (!bestMatch || jaccard > bestMatch.score) {
        bestMatch = { storyId: story.id, score: jaccard };
      }
    }

    const threshold = 0.3;
    if (bestMatch && bestMatch.score >= threshold) {
      return {
        shouldCluster: true,
        storyId: bestMatch.storyId,
        confidence: bestMatch.score,
        reasoning: `Title word overlap: ${(bestMatch.score * 100).toFixed(1)}%`,
        similarity: bestMatch.score,
      };
    }

    return {
      shouldCluster: false,
      confidence: 0.5,
      reasoning: 'No strong match (fallback mode)',
      similarity: bestMatch?.score,
    };
  }
}
