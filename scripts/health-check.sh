#!/bin/bash
# Rafineri System Health Check
# Usage: ./scripts/health-check.sh

echo "🩺 Rafineri System Health Check"
echo "================================"
echo ""

# Colors
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to check HTTP endpoint
check_endpoint() {
    local name=$1
    local url=$2
    local token=$3
    
    if [ -n "$token" ]; then
        response=$(curl -s -o /dev/null -w "%{http_code}" -H "x-admin-token: $token" "$url" 2>/dev/null)
    else
        response=$(curl -s -o /dev/null -w "%{http_code}" "$url" 2>/dev/null)
    fi
    
    if [ "$response" = "200" ] || [ "$response" = "201" ]; then
        echo -e "${GREEN}✓${NC} $name"
        return 0
    else
        echo -e "${RED}✗${NC} $name (HTTP $response)"
        return 1
    fi
}

# Calculate admin token hash
ADMIN_TOKEN_HASH=$(echo -n "${RAFINERI_ADMIN:-admin}:${RAFINERI_ADMIN_PASSWORD:-changeme}" | sha256sum | cut -d' ' -f1)

echo "📊 Services Status:"
echo "-------------------"

# Check services
check_endpoint "PostgreSQL (via API)" "http://localhost:3001/v1/health" "$ADMIN_TOKEN_HASH"
check_endpoint "Redis (via API)" "http://localhost:3001/v1/health" "$ADMIN_TOKEN_HASH"
check_endpoint "API" "http://localhost:3001/v1/health" "$ADMIN_TOKEN_HASH"
check_endpoint "Web" "http://localhost:3000" ""

echo ""
echo "📋 Admin Console Endpoints:"
echo "---------------------------"
check_endpoint "Dashboard" "http://localhost:3001/v1/admin/dashboard" "$ADMIN_TOKEN_HASH"
check_endpoint "Sources" "http://localhost:3001/v1/admin/sources" "$ADMIN_TOKEN_HASH"
check_endpoint "Stories" "http://localhost:3001/v1/admin/stories" "$ADMIN_TOKEN_HASH"
check_endpoint "Health" "http://localhost:3001/v1/admin/health" "$ADMIN_TOKEN_HASH"

echo ""
echo "🔗 Useful URLs:"
echo "---------------"
echo "  Web App:        http://localhost:3000"
echo "  API Docs:       http://localhost:3001/docs"
echo "  API Health:     http://localhost:3001/v1/health"
echo "  Admin Panel:    http://localhost:3000/admin"
echo ""
echo "🔑 Admin Token Hash: $ADMIN_TOKEN_HASH"
echo ""

# Database check
echo "💾 Database Tables:"
echo "-------------------"
if docker compose ps postgres &>/dev/null; then
    docker compose exec postgres psql -U rafineri -d rafineri -c "SELECT schemaname, tablename, n_tup_ins - n_tup_del as row_count FROM pg_stat_user_tables WHERE schemaname='public' ORDER BY tablename;" 2>/dev/null | grep -E "(sources|stories|items|story_events|claims|evidence)" | while read line; do
        echo "  $line"
    done
else
    echo "  PostgreSQL not running in docker compose"
fi

echo ""
