-- Rafineri Database Setup Script
-- Run this to initialize or fix missing database objects

-- ============================================
-- Types (safe to re-run - uses IF NOT EXISTS)
-- ============================================

DO $$ BEGIN
    CREATE TYPE "verifiability_label" AS ENUM('verified', 'likely', 'contested', 'unverified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "source_type" AS ENUM('hackernews', 'reddit', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "claim_type" AS ENUM('fact', 'opinion', 'prediction', 'quote');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "claim_status" AS ENUM('pending', 'verified', 'disputed', 'debunked');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "evidence_stance" AS ENUM('supporting', 'contradicting', 'neutral');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "event_type" AS ENUM('story_created', 'item_added', 'claim_added', 'evidence_added', 'label_changed', 'score_updated', 'thumbnail_extracted');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "thumbnail_source" AS ENUM('og_image', 'twitter_image', 'favicon', 'placeholder', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "thumbnail_refresh_job_status" AS ENUM('pending', 'processing', 'completed', 'failed');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Tables (safe to re-run - uses IF NOT EXISTS)
-- ============================================

CREATE TABLE IF NOT EXISTS "sources" (
    "id" serial PRIMARY KEY NOT NULL,
    "name" varchar(100) NOT NULL,
    "type" source_type NOT NULL,
    "url" varchar(500),
    "is_active" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "items" (
    "id" serial PRIMARY KEY NOT NULL,
    "source_type" source_type NOT NULL,
    "external_id" varchar(100) NOT NULL,
    "url" varchar(1000) NOT NULL,
    "canonical_url" varchar(1000),
    "title" varchar(500) NOT NULL,
    "content" text,
    "author" varchar(100),
    "score" integer DEFAULT 0 NOT NULL,
    "posted_at" timestamp with time zone,
    "raw_data" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "stories" (
    "id" serial PRIMARY KEY NOT NULL,
    "title" varchar(500) NOT NULL,
    "summary" text,
    "label" verifiability_label DEFAULT 'unverified' NOT NULL,
    "confidence" real DEFAULT 0 NOT NULL,
    "thumbnail_url" varchar(1000),
    "hot_score" integer DEFAULT 0 NOT NULL,
    "verification_score" integer DEFAULT 0 NOT NULL,
    "controversy_score" integer DEFAULT 0 NOT NULL,
    "sources_count" integer DEFAULT 0 NOT NULL,
    "evidence_count" integer DEFAULT 0 NOT NULL,
    "contradictions_count" integer DEFAULT 0 NOT NULL,
    "claims_count" integer DEFAULT 0 NOT NULL,
    "seen_on" jsonb,
    "first_seen_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "canonical_url" varchar(1000),
    "item_count" integer DEFAULT 0 NOT NULL,
    "last_thumbnail_refresh" timestamp with time zone,
    "thumbnail_source" thumbnail_source,
    "is_placeholder" integer DEFAULT 0 NOT NULL,
    "placeholder_gradient" jsonb
);

CREATE TABLE IF NOT EXISTS "story_items" (
    "id" serial PRIMARY KEY NOT NULL,
    "story_id" integer NOT NULL,
    "item_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "claims" (
    "id" serial PRIMARY KEY NOT NULL,
    "story_id" integer NOT NULL,
    "text" text NOT NULL,
    "type" claim_type DEFAULT 'fact' NOT NULL,
    "status" claim_status DEFAULT 'pending' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "evidence" (
    "id" serial PRIMARY KEY NOT NULL,
    "story_id" integer NOT NULL,
    "url" varchar(1000) NOT NULL,
    "title" varchar(255) NOT NULL,
    "stance" evidence_stance DEFAULT 'neutral' NOT NULL,
    "snippet" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

CREATE TABLE IF NOT EXISTS "thumbnail_refresh_jobs" (
    "id" serial PRIMARY KEY NOT NULL,
    "story_id" integer NOT NULL,
    "status" thumbnail_refresh_job_status DEFAULT 'pending' NOT NULL,
    "url" varchar(1000) NOT NULL,
    "result" jsonb,
    "error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone
);

CREATE TABLE IF NOT EXISTS "story_events" (
    "id" serial PRIMARY KEY NOT NULL,
    "story_id" integer NOT NULL,
    "event_type" event_type NOT NULL,
    "data" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- ============================================
-- Indexes (safe to re-run - uses IF NOT EXISTS)
-- ============================================

CREATE INDEX IF NOT EXISTS "source_type_idx" ON "sources" ("type");
CREATE UNIQUE INDEX IF NOT EXISTS "item_source_external_idx" ON "items" ("source_type", "external_id");
CREATE INDEX IF NOT EXISTS "item_source_type_idx" ON "items" ("source_type");
CREATE INDEX IF NOT EXISTS "item_canonical_url_idx" ON "items" ("canonical_url");
CREATE INDEX IF NOT EXISTS "item_posted_at_idx" ON "items" ("posted_at");
CREATE INDEX IF NOT EXISTS "story_label_idx" ON "stories" ("label");
CREATE INDEX IF NOT EXISTS "story_hot_score_idx" ON "stories" ("hot_score");
CREATE INDEX IF NOT EXISTS "story_verification_idx" ON "stories" ("verification_score");
CREATE INDEX IF NOT EXISTS "story_controversy_idx" ON "stories" ("controversy_score");
CREATE INDEX IF NOT EXISTS "story_first_seen_idx" ON "stories" ("first_seen_at");
CREATE INDEX IF NOT EXISTS "story_updated_at_idx" ON "stories" ("updated_at");
CREATE INDEX IF NOT EXISTS "story_last_thumbnail_refresh_idx" ON "stories" ("last_thumbnail_refresh");
CREATE INDEX IF NOT EXISTS "story_thumbnail_source_idx" ON "stories" ("thumbnail_source");
CREATE INDEX IF NOT EXISTS "story_is_placeholder_idx" ON "stories" ("is_placeholder");
CREATE INDEX IF NOT EXISTS "story_item_story_idx" ON "story_items" ("story_id");
CREATE INDEX IF NOT EXISTS "story_item_item_idx" ON "story_items" ("item_id");
CREATE UNIQUE INDEX IF NOT EXISTS "story_item_unique_idx" ON "story_items" ("story_id", "item_id");
CREATE INDEX IF NOT EXISTS "claim_story_idx" ON "claims" ("story_id");
CREATE INDEX IF NOT EXISTS "claim_status_idx" ON "claims" ("status");
CREATE INDEX IF NOT EXISTS "claim_story_status_idx" ON "claims" ("story_id", "status");
CREATE INDEX IF NOT EXISTS "evidence_story_idx" ON "evidence" ("story_id");
CREATE INDEX IF NOT EXISTS "evidence_stance_idx" ON "evidence" ("stance");
CREATE INDEX IF NOT EXISTS "evidence_story_stance_idx" ON "evidence" ("story_id", "stance");
CREATE INDEX IF NOT EXISTS "thumbnail_refresh_job_story_idx" ON "thumbnail_refresh_jobs" ("story_id");
CREATE INDEX IF NOT EXISTS "thumbnail_refresh_job_status_idx" ON "thumbnail_refresh_jobs" ("status");
CREATE INDEX IF NOT EXISTS "story_event_story_idx" ON "story_events" ("story_id");
CREATE INDEX IF NOT EXISTS "story_event_type_idx" ON "story_events" ("event_type");
CREATE INDEX IF NOT EXISTS "story_event_created_idx" ON "story_events" ("created_at");

-- ============================================
-- Foreign Keys (safe to re-run - uses IF NOT EXISTS via DO block)
-- ============================================

DO $$ BEGIN
    ALTER TABLE "story_items" ADD CONSTRAINT "story_items_story_id_stories_id_fk" 
        FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "story_items" ADD CONSTRAINT "story_items_item_id_items_id_fk" 
        FOREIGN KEY ("item_id") REFERENCES "items"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "claims" ADD CONSTRAINT "claims_story_id_stories_id_fk" 
        FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "evidence" ADD CONSTRAINT "evidence_story_id_stories_id_fk" 
        FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "thumbnail_refresh_jobs" ADD CONSTRAINT "thumbnail_refresh_jobs_story_id_stories_id_fk" 
        FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    ALTER TABLE "story_events" ADD CONSTRAINT "story_events_story_id_stories_id_fk" 
        FOREIGN KEY ("story_id") REFERENCES "stories"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- ============================================
-- Default Data
-- ============================================

-- Insert default sources if not exists
INSERT INTO "sources" ("name", "type", "is_active") 
VALUES 
    ('Hacker News', 'hackernews', 1),
    ('Reddit', 'reddit', 1)
ON CONFLICT DO NOTHING;
