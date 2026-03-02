#!/bin/bash
# Rafineri Database Reset Script
# WARNING: This will delete all data!
# Usage: ./scripts/reset-database.sh

set -e

echo "⚠️  WARNING: This will DELETE ALL DATA in the database!"
echo "=========================================="
read -p "Are you sure? Type 'yes' to continue: " confirm

if [ "$confirm" != "yes" ]; then
    echo "Aborted."
    exit 1
fi

echo ""
echo "🗑️  Resetting database..."

# Check if running in docker compose environment
if docker compose ps postgres &>/dev/null; then
    echo "✓ Docker compose environment detected"
    
    # Stop API and worker to avoid conflicts
    echo "⏳ Stopping API and Worker..."
    docker compose stop api worker 2>/dev/null || true
    
    # Drop and recreate database
    echo "🗑️  Dropping database..."
    docker compose exec postgres dropdb -U rafineri --if-exists rafineri
    
    echo "📦 Creating new database..."
    docker compose exec postgres createdb -U rafineri rafineri
    
    # Run setup script
    echo "📦 Applying schema..."
    docker compose exec -T postgres psql -U rafineri -d rafineri < scripts/setup-database.sql
    
    # Restart services
    echo "🚀 Restarting API and Worker..."
    docker compose up -d api worker
    
    echo ""
    echo "✅ Database reset complete!"
    echo ""
    echo "📋 Current tables:"
    docker compose exec postgres psql -U rafineri -d rafineri -c "\dt" | grep -E "(sources|stories|items)" || true
    
else
    echo "❌ Docker compose environment not found"
    echo "Make sure you're in the rafineri directory and docker is running"
    exit 1
fi
