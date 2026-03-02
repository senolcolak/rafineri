#!/bin/bash
# Rafineri Database Setup Script
# Usage: ./scripts/setup-database.sh

set -e

echo "🚀 Rafineri Database Setup"
echo "=========================="

# Check if running in docker compose environment
if docker compose ps postgres &>/dev/null; then
    echo "✓ Docker compose environment detected"
    
    # Wait for postgres to be ready
    echo "⏳ Waiting for PostgreSQL to be ready..."
    until docker compose exec postgres pg_isready -U rafineri -d rafineri 2>/dev/null; do
        sleep 1
    done
    echo "✓ PostgreSQL is ready"
    
    # Run the SQL setup script
    echo "📦 Applying database schema..."
    docker compose exec -T postgres psql -U rafineri -d rafineri < scripts/setup-database.sql
    
    echo ""
    echo "✅ Database setup complete!"
    echo ""
    
    # Verify tables exist
    echo "📋 Verifying tables:"
    docker compose exec postgres psql -U rafineri -d rafineri -c "\dt" | grep -E "(sources|stories|items|story_events|claims|evidence)" || true
    
    echo ""
    echo "📋 Verifying default sources:"
    docker compose exec postgres psql -U rafineri -d rafineri -c "SELECT name, type, is_active FROM sources;" || true
    
else
    echo "❌ Docker compose environment not found"
    echo "Make sure you're in the rafineri directory and docker is running"
    exit 1
fi
