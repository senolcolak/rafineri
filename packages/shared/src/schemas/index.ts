/**
 * Zod schemas for validation and type inference
 */

import { z } from 'zod';

// ============================================
// Enum Schemas
// ============================================

/** Verifiability labels for stories */
export const VerifiabilityLabelSchema = z.enum([
  'verified',
  'likely',
  'contested',
  'unverified',
]);

/** Sort options for story feeds */
export const SortOptionSchema = z.enum([
  'hot',
  'most_verified',
  'most_contested',
  'newest',
]);

/** Source types for items */
export const SourceTypeSchema = z.enum([
  'hackernews',
  'reddit',
  'manual',
]);

/** Types of claims */
export const ClaimTypeSchema = z.enum([
  'fact',
  'opinion',
  'prediction',
  'quote',
]);

/** Status of a claim */
export const ClaimStatusSchema = z.enum([
  'pending',
  'verified',
  'disputed',
  'debunked',
]);

/** Stance of evidence */
export const EvidenceStanceSchema = z.enum([
  'supporting',
  'contradicting',
  'neutral',
]);

/** Types of story events */
export const StoryEventTypeSchema = z.enum([
  'created',
  'item_added',
  'claim_added',
  'evidence_added',
  'label_changed',
  'score_updated',
]);

// ============================================
// Core Entity Schemas
// ============================================

/** Item schema - represents content from external sources */
export const ItemSchema = z.object({
  id: z.string().uuid(),
  source_type: SourceTypeSchema,
  external_id: z.string().min(1).max(255),
  url: z.string().url().max(2048),
  canonical_url: z.string().url().max(2048).nullable(),
  title: z.string().min(1).max(512),
  content: z.string().nullable(),
  author: z.string().max(255).nullable(),
  score: z.number().int().default(0),
  posted_at: z.date(),
  raw_data: z.record(z.unknown()).nullable(),
  created_at: z.date(),
});

/** Story schema - groups related items */
export const StorySchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(512),
  summary: z.string().nullable(),
  label: VerifiabilityLabelSchema,
  confidence: z.number().min(0).max(1),
  thumbnail_url: z.string().url().max(2048).nullable(),
  first_seen_at: z.date(),
  updated_at: z.date(),
  created_at: z.date(),
});

/** StoryItem junction schema */
export const StoryItemSchema = z.object({
  story_id: z.string().uuid(),
  item_id: z.string().uuid(),
});

/** Claim schema - extracted claims from stories */
export const ClaimSchema = z.object({
  id: z.string().uuid(),
  story_id: z.string().uuid(),
  text: z.string().min(1).max(2000),
  type: ClaimTypeSchema,
  status: ClaimStatusSchema,
  created_at: z.date(),
});

/** Evidence schema - supporting/contradicting evidence */
export const EvidenceSchema = z.object({
  id: z.string().uuid(),
  story_id: z.string().uuid(),
  url: z.string().url().max(2048),
  title: z.string().min(1).max(512),
  stance: EvidenceStanceSchema,
  snippet: z.string().max(2000).nullable(),
  created_at: z.date(),
});

/** StoryEvent schema - timeline events */
export const StoryEventSchema = z.object({
  id: z.string().uuid(),
  story_id: z.string().uuid(),
  event_type: StoryEventTypeSchema,
  data: z.record(z.unknown()).nullable(),
  created_at: z.date(),
});

/** Source schema - external source configuration */
export const SourceSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1).max(255),
  type: SourceTypeSchema,
  url: z.string().url().max(2048),
  is_active: z.boolean().default(true),
});

// ============================================
// Score/Result Schemas
// ============================================

/** Score result schema */
export const ScoreResultSchema = z.object({
  should_include: z.boolean(),
  confidence: z.number().min(0).max(1),
  reasoning: z.string(),
  suggested_story_id: z.string().uuid().nullable(),
  suggested_labels: z.array(VerifiabilityLabelSchema),
});

// ============================================
// API Schemas
// ============================================

/** Pagination parameters schema */
export const PaginationParamsSchema = z.object({
  limit: z.number().int().min(1).max(100).default(20),
  offset: z.number().int().min(0).default(0),
});

/** Paginated response schema factory */
export function createPaginatedResponseSchema<T extends z.ZodType>(itemSchema: T) {
  return z.object({
    data: z.array(itemSchema),
    total: z.number().int().min(0),
    limit: z.number().int().min(1),
    offset: z.number().int().min(0),
  });
}

// ============================================
// Input/Create Schemas (for API requests)
// ============================================

/** Schema for creating a new item */
export const CreateItemSchema = ItemSchema.omit({
  id: true,
  created_at: true,
}).extend({
  posted_at: z.date().optional().default(() => new Date()),
});

/** Schema for creating a new story */
export const CreateStorySchema = StorySchema.omit({
  id: true,
  first_seen_at: true,
  updated_at: true,
  created_at: true,
}).extend({
  label: VerifiabilityLabelSchema.optional().default('unverified'),
  confidence: z.number().min(0).max(1).optional().default(0),
});

/** Schema for creating a story-item link */
export const CreateStoryItemSchema = StoryItemSchema;

/** Schema for creating a new claim */
export const CreateClaimSchema = ClaimSchema.omit({
  id: true,
  created_at: true,
}).extend({
  status: ClaimStatusSchema.optional().default('pending'),
});

/** Schema for creating new evidence */
export const CreateEvidenceSchema = EvidenceSchema.omit({
  id: true,
  created_at: true,
});

/** Schema for creating a story event */
export const CreateStoryEventSchema = StoryEventSchema.omit({
  id: true,
  created_at: true,
}).extend({
  data: z.record(z.unknown()).optional().default({}),
});

/** Schema for creating a source */
export const CreateSourceSchema = SourceSchema.omit({
  id: true,
}).extend({
  is_active: z.boolean().optional().default(true),
});

// ============================================
// Update Schemas
// ============================================

/** Schema for updating a story */
export const UpdateStorySchema = z.object({
  title: z.string().min(1).max(512).optional(),
  summary: z.string().nullable().optional(),
  label: VerifiabilityLabelSchema.optional(),
  confidence: z.number().min(0).max(1).optional(),
  thumbnail_url: z.string().url().max(2048).nullable().optional(),
});

/** Schema for updating a claim */
export const UpdateClaimSchema = z.object({
  text: z.string().min(1).max(2000).optional(),
  type: ClaimTypeSchema.optional(),
  status: ClaimStatusSchema.optional(),
});

/** Schema for updating a source */
export const UpdateSourceSchema = z.object({
  name: z.string().min(1).max(255).optional(),
  url: z.string().url().max(2048).optional(),
  is_active: z.boolean().optional(),
});

// ============================================
// Query/Filter Schemas
// ============================================

/** Schema for story list filters */
export const StoryFilterSchema = z.object({
  label: VerifiabilityLabelSchema.optional(),
  source_type: SourceTypeSchema.optional(),
  search: z.string().max(255).optional(),
  sort: SortOptionSchema.optional().default('hot'),
});

/** Schema for item list filters */
export const ItemFilterSchema = z.object({
  source_type: SourceTypeSchema.optional(),
  has_story: z.boolean().optional(),
  min_score: z.number().int().min(0).optional(),
  posted_after: z.date().optional(),
  posted_before: z.date().optional(),
});
