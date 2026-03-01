/**
 * Rafineri Shared Package
 * 
 * Shared types, Zod schemas, and UI enums for the Rafineri platform.
 */

// ============================================
// Types
// ============================================

export type {
  // Enums
  VerifiabilityLabel,
  Label,
  SortOption,
  SourceType,
  ClaimType,
  ClaimStatus,
  EvidenceStance,
  StoryEventType,
  // Entities
  Item,
  Story,
  StoryItem,
  Claim,
  Evidence,
  StoryEvent,
  Source,
  // Results
  ScoreResult,
  // API
  PaginationParams,
  PaginatedResponse,
  StoryWithRelations,
  ItemWithStory,
} from './types/index.js';

// ============================================
// Schemas
// ============================================

export {
  // Enum schemas
  VerifiabilityLabelSchema,
  SortOptionSchema,
  SourceTypeSchema,
  ClaimTypeSchema,
  ClaimStatusSchema,
  EvidenceStanceSchema,
  StoryEventTypeSchema,
  // Entity schemas
  ItemSchema,
  StorySchema,
  StoryItemSchema,
  ClaimSchema,
  EvidenceSchema,
  StoryEventSchema,
  SourceSchema,
  // Result schemas
  ScoreResultSchema,
  // API schemas
  PaginationParamsSchema,
  createPaginatedResponseSchema,
  // Input schemas
  CreateItemSchema,
  CreateStorySchema,
  CreateStoryItemSchema,
  CreateClaimSchema,
  CreateEvidenceSchema,
  CreateStoryEventSchema,
  CreateSourceSchema,
  // Update schemas
  UpdateStorySchema,
  UpdateClaimSchema,
  UpdateSourceSchema,
  // Filter schemas
  StoryFilterSchema,
  ItemFilterSchema,
} from './schemas/index.js';

// ============================================
// Enums / UI Display
// ============================================

export {
  // Display objects
  VERIFIABILITY_LABELS,
  SORT_OPTIONS,
  SOURCE_TYPES,
  CLAIM_TYPES,
  CLAIM_STATUSES,
  EVIDENCE_STANCES,
  // Lists
  VERIFIABILITY_LABEL_LIST,
  SORT_OPTION_LIST,
  SOURCE_TYPE_LIST,
  CLAIM_TYPE_LIST,
  CLAIM_STATUS_LIST,
  EVIDENCE_STANCE_LIST,
  // Helper functions
  getLabelDisplay,
  getSortOptionDisplay,
  getSourceTypeDisplay,
  getClaimTypeDisplay,
  getClaimStatusDisplay,
  getEvidenceStanceDisplay,
  getOrderedLabels,
  isVerified,
  isDisputed,
  // Types
  type LabelDisplay,
  type SortOptionDisplay,
  type SourceTypeDisplay,
  type ClaimTypeDisplay,
  type ClaimStatusDisplay,
  type EvidenceStanceDisplay,
} from './enums/index.js';
