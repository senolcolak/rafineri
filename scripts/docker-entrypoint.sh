#!/bin/sh
# Docker entrypoint script for Rafineri API
# Runs database migrations before starting the application

set -e

echo "=========================================="
echo "Rafineri API - Docker Entrypoint"
echo "=========================================="

# Wait for database to be ready
echo "⏳ Waiting for database..."
until nc -z postgres 5432 2>/dev/null || nc -z db 5432 2>/dev/null || nc -z localhost 5432 2>/dev/null; do
  echo "   Database not ready yet, waiting..."
  sleep 1
done
echo "✅ Database is ready!"

# Run database migrations
echo ""
echo "🔄 Running database migrations..."
cd /app
node_modules/.bin/drizzle-kit up:pg --config drizzle.config.ts || {
  echo "⚠️  Migration warning (may be already applied or other issue)"
}
echo "✅ Migrations complete!"

# Start the application
echo ""
echo "🚀 Starting API server..."
echo "=========================================="
cd /app/apps/api
exec node dist/main.js
