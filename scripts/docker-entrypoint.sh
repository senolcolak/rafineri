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
if ! pg_isready -h "$DB_HOST" -p "$DB_PORT" -U rafineri > /dev/null 2>&1; then
    echo "⚠️  PostgreSQL is not accepting connections yet, waiting..."
    sleep 5
fi

# Run migrations using drizzle-kit
if [ -f "drizzle/0000_nifty_doctor_spectrum.sql" ]; then
    echo "📂 Found migration files, applying..."
    
    # Apply migrations directly with psql as a fallback
    echo "   Applying migrations with psql..."
    PGPASSWORD=rafineri psql -h "$DB_HOST" -p "$DB_PORT" -U rafineri -d rafineri -f drizzle/0000_nifty_doctor_spectrum.sql > /dev/null 2>&1 || {
        echo "⚠️  Some migrations may have already been applied (this is normal)"
    }
    
    echo "✅ Migrations complete!"
else
    echo "⚠️  No migration files found at drizzle/"
    echo "   Creating tables manually..."
    
    # Create basic tables if migrations don't exist
    PGPASSWORD=rafineri psql -h "$DB_HOST" -p "$DB_PORT" -U rafineri -d rafineri << 'EOF'
-- Create enums
DO $$ BEGIN
    CREATE TYPE "verifiability_label" AS ENUM('verified', 'likely', 'contested', 'unverified');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE "source_type" AS ENUM('hackernews', 'reddit', 'manual');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

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
    "last_thumbnail_refresh" timestamp with time zone,
    "thumbnail_source" varchar(50),
    "is_placeholder" integer DEFAULT 0 NOT NULL,
    "placeholder_gradient" jsonb
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
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create story_items junction table
CREATE TABLE IF NOT EXISTS "story_items" (
    "id" serial PRIMARY KEY,
    "story_id" integer NOT NULL,
    "item_id" integer NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create sources table
CREATE TABLE IF NOT EXISTS "sources" (
    "id" serial PRIMARY KEY,
    "name" varchar(100) NOT NULL,
    "type" "source_type" NOT NULL,
    "url" varchar(500),
    "is_active" integer DEFAULT 1 NOT NULL,
    "created_at" timestamp with time zone DEFAULT now() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS "story_hot_score_idx" ON "stories" ("hot_score");
CREATE INDEX IF NOT EXISTS "story_last_thumbnail_refresh_idx" ON "stories" ("last_thumbnail_refresh");
EOF
    echo "✅ Basic tables created!"
fi

# Start the application
echo ""
echo "🚀 Starting API server..."
echo "=========================================="

cd /app/apps/api
exec node dist/main.js
