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

export const approvalRequestStatusEnum = pgEnum('approval_request_status', [
  'queued',
  'processing',
  'awaiting_manual_review',
  'approved',
  'rejected',
  'failed',
  'cancelled',
]);

export const approvalStepTypeEnum = pgEnum('approval_step_type', [
  'cross_check',
  'ai_score',
  'policy_gate',
  'manual_review',
]);

export const approvalStepStatusEnum = pgEnum('approval_step_status', [
  'pending',
  'running',
  'passed',
  'failed',
  'skipped',
]);

export const approvalDecisionEnum = pgEnum('approval_decision', [
  'approved',
  'rejected',
  'escalated',
]);

export const approvalDecisionSourceEnum = pgEnum('approval_decision_source', [
  'automated',
  'manual',
]);

export const adminRoleEnum = pgEnum('admin_role', [
  'admin',
  'editor',
  'reviewer',
  'viewer',
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
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
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

    // Story metadata
    canonicalUrl: varchar('canonical_url', { length: 1000 }),
    itemCount: integer('item_count').default(0).notNull(),
    
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
// Admin Users table
// ============================================

export const adminUsers = pgTable(
  'admin_users',
  {
    id: serial('id').primaryKey(),
    username: varchar('username', { length: 100 }).notNull(),
    email: varchar('email', { length: 255 }).notNull(),
    passwordHash: varchar('password_hash', { length: 255 }).notNull(),
    role: adminRoleEnum('role').default('admin').notNull(),
    isActive: integer('is_active').default(1).notNull(),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    usernameUniqueIdx: uniqueIndex('admin_user_username_unique_idx').on(table.username),
    emailUniqueIdx: uniqueIndex('admin_user_email_unique_idx').on(table.email),
    roleIdx: index('admin_user_role_idx').on(table.role),
    activeIdx: index('admin_user_active_idx').on(table.isActive),
  }),
);

// ============================================
// Admin Sessions table
// ============================================

export const adminSessions = pgTable(
  'admin_sessions',
  {
    id: serial('id').primaryKey(),
    adminUserId: integer('admin_user_id')
      .references(() => adminUsers.id, { onDelete: 'cascade' })
      .notNull(),
    tokenHash: varchar('token_hash', { length: 255 }).notNull(),
    expiresAt: timestamp('expires_at', { withTimezone: true }).notNull(),
    revokedAt: timestamp('revoked_at', { withTimezone: true }),
    lastSeenAt: timestamp('last_seen_at', { withTimezone: true }).defaultNow().notNull(),
    ipAddress: varchar('ip_address', { length: 64 }),
    userAgent: varchar('user_agent', { length: 512 }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    tokenUniqueIdx: uniqueIndex('admin_session_token_unique_idx').on(table.tokenHash),
    userIdx: index('admin_session_user_idx').on(table.adminUserId),
    expiresIdx: index('admin_session_expires_idx').on(table.expiresAt),
  }),
);

// ============================================
// System Settings table
// ============================================

export const systemSettings = pgTable(
  'system_settings',
  {
    id: serial('id').primaryKey(),
    key: varchar('key', { length: 150 }).notNull(),
    value: jsonb('value').notNull(),
    version: integer('version').default(1).notNull(),
    updatedBy: integer('updated_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    keyUniqueIdx: uniqueIndex('system_settings_key_unique_idx').on(table.key),
    updatedAtIdx: index('system_settings_updated_at_idx').on(table.updatedAt),
  }),
);

// ============================================
// Audit Logs table
// ============================================

export const auditLogs = pgTable(
  'audit_logs',
  {
    id: serial('id').primaryKey(),
    adminUserId: integer('admin_user_id').references(() => adminUsers.id, { onDelete: 'set null' }),
    action: varchar('action', { length: 100 }).notNull(),
    entityType: varchar('entity_type', { length: 100 }).notNull(),
    entityId: varchar('entity_id', { length: 100 }),
    metadata: jsonb('metadata'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    adminUserIdx: index('audit_log_admin_user_idx').on(table.adminUserId),
    actionIdx: index('audit_log_action_idx').on(table.action),
    entityIdx: index('audit_log_entity_idx').on(table.entityType, table.entityId),
    createdAtIdx: index('audit_log_created_at_idx').on(table.createdAt),
  }),
);

// ============================================
// Approval Requests table
// ============================================

export const approvalRequests = pgTable(
  'approval_requests',
  {
    id: serial('id').primaryKey(),
    storyId: integer('story_id')
      .references(() => stories.id, { onDelete: 'cascade' })
      .notNull(),
    status: approvalRequestStatusEnum('status').default('queued').notNull(),
    priority: integer('priority').default(0).notNull(),
    idempotencyKey: varchar('idempotency_key', { length: 255 }).notNull(),
    submittedBy: integer('submitted_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    assignedReviewer: integer('assigned_reviewer').references(() => adminUsers.id, { onDelete: 'set null' }),
    finalConfidence: real('final_confidence'),
    finalReason: text('final_reason'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
  },
  (table) => ({
    idempotencyUniqueIdx: uniqueIndex('approval_request_idempotency_unique_idx').on(table.idempotencyKey),
    storyIdx: index('approval_request_story_idx').on(table.storyId),
    statusPriorityIdx: index('approval_request_status_priority_idx').on(table.status, table.priority, table.createdAt),
    submittedByIdx: index('approval_request_submitted_by_idx').on(table.submittedBy),
    reviewerIdx: index('approval_request_reviewer_idx').on(table.assignedReviewer),
  }),
);

// ============================================
// Approval Steps table
// ============================================

export const approvalSteps = pgTable(
  'approval_steps',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id')
      .references(() => approvalRequests.id, { onDelete: 'cascade' })
      .notNull(),
    stepType: approvalStepTypeEnum('step_type').notNull(),
    status: approvalStepStatusEnum('status').default('pending').notNull(),
    inputJson: jsonb('input_json'),
    outputJson: jsonb('output_json'),
    errorJson: jsonb('error_json'),
    startedAt: timestamp('started_at', { withTimezone: true }),
    completedAt: timestamp('completed_at', { withTimezone: true }),
    durationMs: integer('duration_ms'),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    requestIdx: index('approval_step_request_idx').on(table.requestId),
    typeIdx: index('approval_step_type_idx').on(table.stepType),
    statusIdx: index('approval_step_status_idx').on(table.status),
  }),
);

// ============================================
// Approval Decisions table
// ============================================

export const approvalDecisions = pgTable(
  'approval_decisions',
  {
    id: serial('id').primaryKey(),
    requestId: integer('request_id')
      .references(() => approvalRequests.id, { onDelete: 'cascade' })
      .notNull(),
    decision: approvalDecisionEnum('decision').notNull(),
    reason: text('reason').notNull(),
    confidence: real('confidence').notNull(),
    decidedBy: integer('decided_by').references(() => adminUsers.id, { onDelete: 'set null' }),
    source: approvalDecisionSourceEnum('source').notNull(),
    createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  },
  (table) => ({
    requestIdx: index('approval_decision_request_idx').on(table.requestId),
    decisionIdx: index('approval_decision_idx').on(table.decision),
    decidedByIdx: index('approval_decision_decided_by_idx').on(table.decidedBy),
  }),
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
  approvalRequests: many(approvalRequests),
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

export const adminUsersRelations = relations(adminUsers, ({ many }) => ({
  sessions: many(adminSessions),
  submittedApprovals: many(approvalRequests, { relationName: 'submitted_approvals' }),
  assignedApprovals: many(approvalRequests, { relationName: 'assigned_approvals' }),
  approvalDecisions: many(approvalDecisions),
  settingUpdates: many(systemSettings),
  auditLogs: many(auditLogs),
}));

export const adminSessionsRelations = relations(adminSessions, ({ one }) => ({
  user: one(adminUsers, {
    fields: [adminSessions.adminUserId],
    references: [adminUsers.id],
  }),
}));

export const systemSettingsRelations = relations(systemSettings, ({ one }) => ({
  updater: one(adminUsers, {
    fields: [systemSettings.updatedBy],
    references: [adminUsers.id],
  }),
}));

export const auditLogsRelations = relations(auditLogs, ({ one }) => ({
  adminUser: one(adminUsers, {
    fields: [auditLogs.adminUserId],
    references: [adminUsers.id],
  }),
}));

export const approvalRequestsRelations = relations(approvalRequests, ({ one, many }) => ({
  story: one(stories, {
    fields: [approvalRequests.storyId],
    references: [stories.id],
  }),
  submittedByUser: one(adminUsers, {
    relationName: 'submitted_approvals',
    fields: [approvalRequests.submittedBy],
    references: [adminUsers.id],
  }),
  assignedReviewerUser: one(adminUsers, {
    relationName: 'assigned_approvals',
    fields: [approvalRequests.assignedReviewer],
    references: [adminUsers.id],
  }),
  steps: many(approvalSteps),
  decisions: many(approvalDecisions),
}));

export const approvalStepsRelations = relations(approvalSteps, ({ one }) => ({
  request: one(approvalRequests, {
    fields: [approvalSteps.requestId],
    references: [approvalRequests.id],
  }),
}));

export const approvalDecisionsRelations = relations(approvalDecisions, ({ one }) => ({
  request: one(approvalRequests, {
    fields: [approvalDecisions.requestId],
    references: [approvalRequests.id],
  }),
  decidedByUser: one(adminUsers, {
    fields: [approvalDecisions.decidedBy],
    references: [adminUsers.id],
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
