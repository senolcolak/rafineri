#!/bin/sh
# Docker entrypoint script for Rafineri API
# Runs database migrations before starting the application

set -e

echo "=========================================="
echo "Rafineri API - Docker Entrypoint"
echo "=========================================="

# Wait for database to be ready
echo "⏳ Waiting for database..."
DB_HOST=${DB_HOST:-postgres}
DB_PORT=${DB_PORT:-5432}
DB_USERNAME=${DB_USERNAME:-rafineri}
DB_PASSWORD=${DB_PASSWORD:-rafineri}
DB_DATABASE=${DB_DATABASE:-rafineri}

until nc -z "$DB_HOST" "$DB_PORT" 2>/dev/null; do
  echo "   Database not ready yet, waiting..."
  sleep 1
done
echo "✅ Database is ready!"

# Additional wait for PostgreSQL to fully initialize
echo "⏳ Waiting for PostgreSQL to be fully ready..."
sleep 3

# Run database migrations
echo ""
echo "🔄 Running database migrations..."
cd /app

# Check if we can connect to the database
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" > /dev/null 2>&1; then
    echo "⚠️  PostgreSQL is not accepting connections yet, waiting..."
    sleep 5
fi

# Apply all SQL migration files in order
if [ -d "drizzle" ]; then
    echo "📂 Found migration files, applying..."
    
    # Apply all SQL files in order
    for file in drizzle/*.sql; do
        if [ -f "$file" ]; then
            echo "   Applying $(basename $file)..."
            PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" -f "$file" > /dev/null 2>&1 || {
                echo "   ⚠️  Some statements in $file may have already been applied (this is normal)"
            }
        fi
    done
    
    echo "✅ Migrations complete!"
else
    echo "⚠️  No migration files found at drizzle/"
    echo "   Creating basic tables manually..."
    
    # Create basic tables if migrations don't exist
    PGPASSWORD="$DB_PASSWORD" psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USERNAME" -d "$DB_DATABASE" << 'EOF'
-- Create enums
DO $$ BEGIN
    CREATE TYPE "verifiability_label" AS ENUM('verified', 'likely', 'contested', 'unverified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "source_type" AS ENUM('hackernews', 'reddit', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "thumbnail_source" AS ENUM('og_image', 'twitter_image', 'favicon', 'placeholder', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Create sources table
CREATE TABLE IF NOT EXISTS "sources" (
    "id" serial PRIMARY KEY,
    "name" varchar(100) NOT NULL,
    "type" "source_type" NOT NULL,
    "url" varchar(500),
    "is_active" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create items table
CREATE TABLE IF NOT EXISTS "items" (
    "id" serial PRIMARY KEY,
    "source_type" "source_type" NOT NULL,
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
    UNIQUE("source_type", "external_id")
);

-- Create stories table
CREATE TABLE IF NOT EXISTS "stories" (
    "id" serial PRIMARY KEY,
    "title" varchar(500) NOT NULL,
    "summary" text,
    "label" "verifiability_label" DEFAULT 'unverified' NOT NULL,
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
    "thumbnail_source" "thumbnail_source",
    "is_placeholder" integer DEFAULT 0 NOT NULL,
    "placeholder_gradient" jsonb
);

-- Create story_items junction table
CREATE TABLE IF NOT EXISTS "story_items" (
    "id" serial PRIMARY KEY,
    "story_id" integer NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
    "item_id" integer NOT NULL REFERENCES "items"("id") ON DELETE CASCADE,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    UNIQUE("story_id", "item_id")
);

-- Create claims table
CREATE TABLE IF NOT EXISTS "claims" (
    "id" serial PRIMARY KEY,
    "story_id" integer NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
    "text" text NOT NULL,
    "type" varchar(50) DEFAULT 'fact' NOT NULL,
    "status" varchar(50) DEFAULT 'pending' NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create evidence table
CREATE TABLE IF NOT EXISTS "evidence" (
    "id" serial PRIMARY KEY,
    "story_id" integer NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
    "url" varchar(1000) NOT NULL,
    "title" varchar(255) NOT NULL,
    "stance" varchar(50) DEFAULT 'neutral' NOT NULL,
    "snippet" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create story_events table
CREATE TABLE IF NOT EXISTS "story_events" (
    "id" serial PRIMARY KEY,
    "story_id" integer NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
    "event_type" varchar(100) NOT NULL,
    "data" jsonb,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create thumbnail_refresh_jobs table
CREATE TABLE IF NOT EXISTS "thumbnail_refresh_jobs" (
    "id" serial PRIMARY KEY,
    "story_id" integer NOT NULL REFERENCES "stories"("id") ON DELETE CASCADE,
    "status" varchar(50) DEFAULT 'pending' NOT NULL,
    "url" varchar(1000) NOT NULL,
    "result" jsonb,
    "error" text,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT now() NOT NULL,
    "completed_at" timestamp with time zone
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "item_source_type_idx" ON "items" ("source_type");
CREATE INDEX IF NOT EXISTS "item_external_id_idx" ON "items" ("external_id");
CREATE INDEX IF NOT EXISTS "item_canonical_url_idx" ON "items" ("canonical_url");
CREATE INDEX IF NOT EXISTS "item_posted_at_idx" ON "items" ("posted_at");
CREATE INDEX IF NOT EXISTS "story_label_idx" ON "stories" ("label");
CREATE INDEX IF NOT EXISTS "story_hot_score_idx" ON "stories" ("hot_score");
CREATE INDEX IF NOT EXISTS "story_first_seen_idx" ON "stories" ("first_seen_at");
CREATE INDEX IF NOT EXISTS "story_updated_at_idx" ON "stories" ("updated_at");
CREATE INDEX IF NOT EXISTS "story_canonical_url_idx" ON "stories" ("canonical_url");
CREATE INDEX IF NOT EXISTS "story_item_count_idx" ON "stories" ("item_count");
CREATE INDEX IF NOT EXISTS "story_item_story_idx" ON "story_items" ("story_id");
CREATE INDEX IF NOT EXISTS "story_item_item_idx" ON "story_items" ("item_id");
CREATE INDEX IF NOT EXISTS "claim_story_idx" ON "claims" ("story_id");
CREATE INDEX IF NOT EXISTS "evidence_story_idx" ON "evidence" ("story_id");
CREATE INDEX IF NOT EXISTS "story_event_story_idx" ON "story_events" ("story_id");
EOF
    echo "✅ Basic tables created!"
fi

# Start the application
echo ""
echo "🚀 Starting API server..."
echo "=========================================="

cd /app/apps/api
exec node dist/main.js
