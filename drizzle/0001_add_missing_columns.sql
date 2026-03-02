-- Migration: Add missing columns for MVP
-- These columns are needed by the clustering service and ingestion

-- Add canonical_url column for story URL
ALTER TABLE "stories" 
ADD COLUMN IF NOT EXISTS "canonical_url" varchar(1000);

-- Add item_count column for tracking number of items in story
ALTER TABLE "stories" 
ADD COLUMN IF NOT EXISTS "item_count" integer DEFAULT 0 NOT NULL;

-- Add updated_at column for items table (needed for ingestion upserts)
ALTER TABLE "items" 
ADD COLUMN IF NOT EXISTS "updated_at" timestamp with time zone DEFAULT now() NOT NULL;

-- Add index on canonical_url for faster lookups
CREATE INDEX IF NOT EXISTS "story_canonical_url_idx" ON "stories" ("canonical_url");

-- Add index on item_count for sorting/filtering
CREATE INDEX IF NOT EXISTS "story_item_count_idx" ON "stories" ("item_count");

-- Add index on items updated_at
CREATE INDEX IF NOT EXISTS "item_updated_at_idx" ON "items" ("updated_at");
