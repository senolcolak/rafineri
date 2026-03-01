/**
 * Core types for the Rafineri platform
 */

// ============================================
// Enums / Literal Types
// ============================================

/** Verifiability labels for stories */
export type VerifiabilityLabel = 'verified' | 'likely' | 'contested' | 'unverified';

/** @deprecated Use VerifiabilityLabel instead */
export type Label = VerifiabilityLabel;

/** Sort options for story feeds */
export type SortOption = 'hot' | 'most_verified' | 'most_contested' | 'newest';

/** Source types for items */
export type SourceType = 'hackernews' | 'reddit' | 'manual';

/** Types of claims that can be made */
export type ClaimType = 'fact' | 'opinion' | 'prediction' | 'quote';

/** Status of a claim */
export type ClaimStatus = 'pending' | 'verified' | 'disputed' | 'debunked';

/** Stance of evidence towards a claim */
export type EvidenceStance = 'supporting' | 'contradicting' | 'neutral';

/** Types of story events */
export type StoryEventType = 
  | 'created'
  | 'item_added'
  | 'claim_added'
  | 'evidence_added'
  | 'label_changed'
  | 'score_updated';

// ============================================
// Core Entity Types
// ============================================

/** Represents an item scraped from an external source (Hacker News, Reddit, etc.) */
export interface Item {
  /** Unique identifier */
  id: string;
  /** Source type (hackernews, reddit, manual) */
  source_type: SourceType;
  /** External ID from the source platform */
  external_id: string;
  /** Original URL */
  url: string;
  /** Canonical URL after redirects/normalization */
  canonical_url: string | null;
  /** Title of the item */
  title: string;
  /** Content/text of the item */
  content: string | null;
  /** Author username */
  author: string | null;
  /** Score (upvotes, points, etc.) from source */
  score: number;
  /** When the item was posted on the source */
  posted_at: Date;
  /** Raw data from the source API */
  raw_data: Record<string, unknown> | null;
  /** When the item was created in our system */
  created_at: Date;
}

/** Represents a story - a grouping of related items with claims and evidence */
export interface Story {
  /** Unique identifier */
  id: string;
  /** Story title */
  title: string;
  /** AI-generated summary */
  summary: string | null;
  /** Original URL */
  url: string | null;
  /** Verifiability label */
  label: VerifiabilityLabel;
  /** Confidence score (0-1) */
  confidence: number;
  /** Score (0-100) for UI display */
  score: number;
  /** URL to thumbnail image */
  imageUrl: string | null;
  /** Category */
  category: string;
  /** Number of evidence items */
  evidenceCount: number;
  /** Number of contradictions */
  contradictionsCount: number;
  /** Sources where the story was seen */
  seenOn: Array<'hn' | 'reddit' | 'manual'>;
  /** When the story was published */
  publishedAt: string;
  /** When the story was first seen (ISO string for frontend) */
  first_seen_at: Date | string;
  /** When the story was created (ISO string for frontend) */
  created_at: Date | string;
  /** When the story was last updated (ISO string for frontend) */
  updated_at: Date | string;
}

/** Junction table linking stories to their source items */
export interface StoryItem {
  /** Reference to the story */
  story_id: string;
  /** Reference to the item */
  item_id: string;
}

/** Represents a claim extracted from a story */
export interface Claim {
  /** Unique identifier */
  id: string;
  /** Reference to the story */
  story_id: string;
  /** The claim text */
  text: string;
  /** Type of claim */
  type: ClaimType;
  /** Current status of the claim */
  status: 'verified' | 'disputed' | 'debunked' | 'unverified';
  /** Confidence score (0-1) */
  confidence: number;
  /** When the claim was created */
  created_at: Date | string;
}

/** Represents evidence supporting or contradicting a claim */
export interface Evidence {
  /** Unique identifier */
  id: string;
  /** Reference to the story */
  story_id: string;
  /** URL to the evidence source */
  url: string;
  /** Title of the evidence */
  title: string;
  /** Source of the evidence */
  source: string;
  /** Stance towards the claims */
  stance: 'supporting' | 'against' | 'neutral';
  /** Credibility score (0-1) */
  credibility: number;
  /** Snippet of relevant content */
  snippet: string | null;
  /** When the evidence was added */
  created_at: Date | string;
}

/** Represents an event in a story's timeline */
export interface StoryEvent {
  /** Unique identifier */
  id: string;
  /** Reference to the story */
  story_id: string;
  /** Type of event */
  event_type: StoryEventType;
  /** Additional event data */
  data: Record<string, unknown> | null;
  /** When the event occurred */
  created_at: Date;
}

/** Represents an external source configuration */
export interface Source {
  /** Unique identifier */
  id: string;
  /** Display name */
  name: string;
  /** Source type */
  type: SourceType;
  /** URL to the source */
  url: string;
  /** Whether the source is active */
  is_active: boolean;
}

// ============================================
// Score/Result Types
// ============================================

/** Result of scoring an item for story relevance */
export interface ScoreResult {
  /** Whether the item should be included */
  should_include: boolean;
  /** Confidence score (0-1) */
  confidence: number;
  /** Reasoning for the score */
  reasoning: string;
  /** Suggested story ID if related to existing story */
  suggested_story_id: string | null;
  /** Suggested labels */
  suggested_labels: VerifiabilityLabel[];
}

// ============================================
// API Types
// ============================================

/** Pagination parameters */
export interface PaginationParams {
  limit: number;
  offset: number;
}

/** Paginated response wrapper */
export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}

/** Paginated stories response for web app */
export interface PaginatedStories {
  stories: Story[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

/** Story with related entities */
export interface StoryWithRelations extends Story {
  items: Item[];
  claims: Claim[];
  evidence: Evidence[];
}

/** Item with its associated story */
export interface ItemWithStory extends Item {
  story: Story | null;
}
