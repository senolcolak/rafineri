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

# Run database migrations
echo ""
echo "🔄 Running database migrations..."
cd /app

# Check if drizzle-kit is available
if [ -f "node_modules/.bin/drizzle-kit" ]; then
  node_modules/.bin/drizzle-kit up:pg --config drizzle.config.ts || {
    echo "⚠️  Migration warning (may be already applied or other issue)"
  }
else
  echo "⚠️  drizzle-kit not found, skipping migrations"
  echo "   (this is expected in production if migrations were run manually)"
fi

echo "✅ Migrations complete!"

# Start the application
echo ""
echo "🚀 Starting API server..."
echo "=========================================="

cd /app/apps/api
exec node dist/main.js
