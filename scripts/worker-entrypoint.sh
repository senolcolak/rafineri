#!/bin/sh
# Docker entrypoint script for Rafineri Worker
# Waits for database to be ready before starting

set -e

echo "=========================================="
echo "Rafineri Worker - Docker Entrypoint"
echo "=========================================="

# Wait for database to be ready
echo "⏳ Waiting for database..."
until nc -z postgres 5432 2>/dev/null || nc -z db 5432 2>/dev/null || nc -z localhost 5432 2>/dev/null; do
  echo "   Database not ready yet, waiting..."
  sleep 1
done
echo "✅ Database is ready!"

# Wait a bit for migrations to potentially run
echo "⏳ Waiting for API migrations to complete..."
sleep 3

# Start the application
echo ""
echo "🚀 Starting Worker..."
echo "=========================================="
cd /app/apps/worker
exec node dist/main.js
