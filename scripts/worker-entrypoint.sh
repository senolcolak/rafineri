#!/bin/sh
# Docker entrypoint script for Rafineri Worker
# Waits for database to be ready before starting

set -e

echo "=========================================="
echo "Rafineri Worker - Docker Entrypoint"
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

# Wait for Redis
echo "⏳ Waiting for Redis..."
REDIS_HOST=${REDIS_HOST:-redis}
REDIS_PORT=${REDIS_PORT:-6379}

until nc -z "$REDIS_HOST" "$REDIS_PORT" 2>/dev/null; do
  echo "   Redis not ready yet, waiting..."
  sleep 1
done
echo "✅ Redis is ready!"

# Wait a bit for API migrations to complete
echo "⏳ Waiting for API to be ready..."
sleep 3

# Start the application
echo ""
echo "🚀 Starting Worker..."
echo "=========================================="

cd /app/apps/worker
exec node dist/main.js
