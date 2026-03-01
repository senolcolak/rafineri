import {
  pgTable,
  serial,
  varchar,
  text,
  timestamp,
  integer,
  jsonb,
  pgEnum,
  index,
  uniqueIndex,
  real,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// ============================================
// Enums
// ============================================

export const verifiabilityLabelEnum = pgEnum('verifiability_label', [
  'verified',
  'likely',
  'contested',
  'unverified',
]);

export const sourceTypeEnum = pgEnum('source_type', [
  'hackernews',
  'reddit',
  'manual',
]);

export const claimTypeEnum = pgEnum('claim_type', [
  'fact',
  'opinion',
  'prediction',
  'quote',
]);

export const claimStatusEnum = pgEnum('claim_status', [
  'pending',
  'verified',
  'disputed',
  'debunked',
]);

export const evidenceStanceEnum = pgEnum('evidence_stance', [
  'supporting',
  'contradicting',
  'neutral',
]);

export const eventTypeEnum = pgEnum('event_type', [
  'story_created',
  'item_added',
  'claim_added',
  'evidence_added',
  'label_changed',
  'score_updated',
  'thumbnail_extracted',
]);

export const thumbnailSourceEnum = pgEnum('thumbnail_source', [
  'og_image',
  'twitter_image',
  'favicon',
  'placeholder',
  'manual',
]);

export const thumbnailRefreshJobStatusEnum = pgEnum('thumbnail_refresh_job_status', [
  'pending',
  'processing',
  'completed',
  'failed',
]);

// ============================================
// Sources table
// ============================================

export const sources = pgTable(
  'sources',
  {
    id: serial('id').primaryKey(),
    name: varchar('name', { length: 100 }).notNull(),
    type: sourceTypeEnum('type').notNull(),
    url: varchar('url', { length: 500 }),
    isActive: integer('is_active').default(1).notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    typeIdx: index('source_type_idx').on(table.type),
  })
);

// ============================================
// Items table (raw ingested content)
// ============================================

export const items = pgTable(
  'items',
  {
    id: serial('id').primaryKey(),
    sourceType: sourceTypeEnum('source_type').notNull(),
    externalId: varchar('external_id', { length: 100 }).notNull(),
    url: varchar('url', { length: 1000 }).notNull(),
    canonicalUrl: varchar('canonical_url', { length: 1000 }),
    title: varchar('title', { length: 500 }).notNull(),
    content: text('content'),
    author: varchar('author', { length: 100 }),
    score: integer('score').default(0).notNull(),
    postedAt: timestamp('posted_at', { withTimezone: true }),
    rawData: jsonb('raw_data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    // Unique constraint on source_type + external_id
    sourceExternalIdx: uniqueIndex('item_source_external_idx').on(table.sourceType, table.externalId),
    sourceTypeIdx: index('item_source_type_idx').on(table.sourceType),
    canonicalUrlIdx: index('item_canonical_url_idx').on(table.canonicalUrl),
    postedAtIdx: index('item_posted_at_idx').on(table.postedAt),
  })
);

// ============================================
// Stories table
// ============================================

export const stories = pgTable(
  'stories',
  {
    id: serial('id').primaryKey(),
    title: varchar('title', { length: 500 }).notNull(),
    summary: text('summary'),
    label: verifiabilityLabelEnum('label').default('unverified').notNull(),
    confidence: real('confidence').default(0).notNull(),
    thumbnailUrl: varchar('thumbnail_url', { length: 1000 }),
    
    // Computed scores for sorting
    hotScore: integer('hot_score').default(0).notNull(),
    verificationScore: integer('verification_score').default(0).notNull(),
    controversyScore: integer('controversy_score').default(0).notNull(),
    
    // Counters (denormalized for performance)
    sourcesCount: integer('sources_count').default(0).notNull(),
    evidenceCount: integer('evidence_count').default(0).notNull(),
    contradictionsCount: integer('contradictions_count').default(0).notNull(),
    claimsCount: integer('claims_count').default(0).notNull(),
    
    // Metadata
    seenOn: jsonb('seen_on').$type<string[]>(),
    firstSeenAt: timestamp('first_seen_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),

    // Thumbnail tracking
    lastThumbnailRefresh: timestamp('last_thumbnail_refresh', { withTimezone: true }),
    thumbnailSource: thumbnailSourceEnum('thumbnail_source'),
    isPlaceholder: integer('is_placeholder').default(0).notNull(),
    placeholderGradient: jsonb('placeholder_gradient').$type<{
      angle: number;
      colors: string[];
      css: string;
    }>(),
  },
  (table) => ({
    labelIdx: index('story_label_idx').on(table.label),
    hotScoreIdx: index('story_hot_score_idx').on(table.hotScore),
    verificationIdx: index('story_verification_idx').on(table.verificationScore),
    controversyIdx: index('story_controversy_idx').on(table.controversyScore),
    firstSeenIdx: index('story_first_seen_idx').on(table.firstSeenAt),
    updatedAtIdx: index('story_updated_at_idx').on(table.updatedAt),
    lastThumbnailRefreshIdx: index('story_last_thumbnail_refresh_idx').on(table.lastThumbnailRefresh),
    thumbnailSourceIdx: index('story_thumbnail_source_idx').on(table.thumbnailSource),
    isPlaceholderIdx: index('story_is_placeholder_idx').on(table.isPlaceholder),
  })
);

// ============================================
// StoryItems junction table
// ============================================

export const storyItems = pgTable(
  'story_items',
  {
    id: serial('id').primaryKey(),
    storyId: integer('story_id')
      .references(() => stories.id, { onDelete: 'cascade' })
      .notNull(),
    itemId: integer('item_id')
      .references(() => items.id, { onDelete: 'cascade' })
      .notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storyIdx: index('story_item_story_idx').on(table.storyId),
    itemIdx: index('story_item_item_idx').on(table.itemId),
    uniqueStoryItemIdx: uniqueIndex('story_item_unique_idx').on(table.storyId, table.itemId),
  })
);

// ============================================
// Claims table
// ============================================

export const claims = pgTable(
  'claims',
  {
    id: serial('id').primaryKey(),
    storyId: integer('story_id')
      .references(() => stories.id, { onDelete: 'cascade' })
      .notNull(),
    text: text('text').notNull(),
    type: claimTypeEnum('type').default('fact').notNull(),
    status: claimStatusEnum('status').default('pending').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storyIdx: index('claim_story_idx').on(table.storyId),
    statusIdx: index('claim_status_idx').on(table.status),
    storyStatusIdx: index('claim_story_status_idx').on(table.storyId, table.status),
  })
);

// ============================================
// Evidence table
// ============================================

export const evidence = pgTable(
  'evidence',
  {
    id: serial('id').primaryKey(),
    storyId: integer('story_id')
      .references(() => stories.id, { onDelete: 'cascade' })
      .notNull(),
    url: varchar('url', { length: 1000 }).notNull(),
    title: varchar('title', { length: 255 }).notNull(),
    stance: evidenceStanceEnum('stance').default('neutral').notNull(),
    snippet: text('snippet'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storyIdx: index('evidence_story_idx').on(table.storyId),
    stanceIdx: index('evidence_stance_idx').on(table.stance),
    storyStanceIdx: index('evidence_story_stance_idx').on(table.storyId, table.stance),
  })
);

// ============================================
// Thumbnail Refresh Jobs table
// ============================================

export const thumbnailRefreshJobs = pgTable(
  'thumbnail_refresh_jobs',
  {
    id: serial('id').primaryKey(),
    storyId: integer('story_id')
      .references(() => stories.id, { onDelete: 'cascade' })
      .notNull(),
    status: thumbnailRefreshJobStatusEnum('status').default('pending').notNull(),
    url: varchar('url', { length: 1000 }).notNull(),
    result: jsonb('result'),
    error: text('error'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    storyIdx: index('thumbnail_refresh_job_story_idx').on(table.storyId),
    statusIdx: index('thumbnail_refresh_job_status_idx').on(table.status),
  })
);

// ============================================
// StoryEvents table (timeline)
// ============================================

export const storyEvents = pgTable(
  'story_events',
  {
    id: serial('id').primaryKey(),
    storyId: integer('story_id')
      .references(() => stories.id, { onDelete: 'cascade' })
      .notNull(),
    eventType: eventTypeEnum('event_type').notNull(),
    data: jsonb('data'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    storyIdx: index('story_event_story_idx').on(table.storyId),
    eventTypeIdx: index('story_event_type_idx').on(table.eventType),
    createdAtIdx: index('story_event_created_idx').on(table.createdAt),
  })
);

// ============================================
// Relations
// ============================================

export const sourcesRelations = relations(sources, ({ many }) => ({
  items: many(items),
}));

export const itemsRelations = relations(items, ({ many }) => ({
  storyItems: many(storyItems),
}));

export const storiesRelations = relations(stories, ({ many }) => ({
  storyItems: many(storyItems),
  claims: many(claims),
  evidence: many(evidence),
  events: many(storyEvents),
  thumbnailRefreshJobs: many(thumbnailRefreshJobs),
}));

export const storyItemsRelations = relations(storyItems, ({ one }) => ({
  story: one(stories, {
    fields: [storyItems.storyId],
    references: [stories.id],
  }),
  item: one(items, {
    fields: [storyItems.itemId],
    references: [items.id],
  }),
}));

export const claimsRelations = relations(claims, ({ one }) => ({
  story: one(stories, {
    fields: [claims.storyId],
    references: [stories.id],
  }),
}));

export const evidenceRelations = relations(evidence, ({ one }) => ({
  story: one(stories, {
    fields: [evidence.storyId],
    references: [stories.id],
  }),
}));

export const storyEventsRelations = relations(storyEvents, ({ one }) => ({
  story: one(stories, {
    fields: [storyEvents.storyId],
    references: [stories.id],
  }),
}));

export const thumbnailRefreshJobsRelations = relations(thumbnailRefreshJobs, ({ one }) => ({
  story: one(stories, {
    fields: [thumbnailRefreshJobs.storyId],
    references: [stories.id],
  }),
}));

// ============================================
// Types
// ============================================

export type Source = typeof sources.$inferSelect;
export type NewSource = typeof sources.$inferInsert;

export type Item = typeof items.$inferSelect;
export type NewItem = typeof items.$inferInsert;

export type Story = typeof stories.$inferSelect;
export type NewStory = typeof stories.$inferInsert;

export type StoryItem = typeof storyItems.$inferSelect;
export type NewStoryItem = typeof storyItems.$inferInsert;

export type Claim = typeof claims.$inferSelect;
export type NewClaim = typeof claims.$inferInsert;

export type Evidence = typeof evidence.$inferSelect;
export type NewEvidence = typeof evidence.$inferInsert;

export type StoryEvent = typeof storyEvents.$inferSelect;
export type NewStoryEvent = typeof storyEvents.$inferInsert;

export type ThumbnailRefreshJob = typeof thumbnailRefreshJobs.$inferSelect;
export type NewThumbnailRefreshJob = typeof thumbnailRefreshJobs.$inferInsert;
