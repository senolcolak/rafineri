#!/bin/bash
# Run database migrations for Rafineri
# Usage: ./scripts/run-migrations.sh [environment]

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

cd "$PROJECT_ROOT"

ENV=${1:-development}
echo "Running migrations for environment: $ENV"

if [ "$ENV" = "docker" ]; then
  # Run migrations inside the Docker container
  echo "Running migrations in Docker..."
  docker compose exec api npx drizzle-kit up:pg
elif [ "$ENV" = "production" ] || [ "$ENV" = "prod" ]; then
  # Production migrations
  echo "Running production migrations..."
  pnpm drizzle-kit up:pg
else
  # Development migrations
  echo "Running development migrations..."
  pnpm drizzle-kit up:pg
fi

echo "✅ Migrations completed successfully!"
