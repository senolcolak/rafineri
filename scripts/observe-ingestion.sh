#!/bin/bash
# Rafineri Ingestion Observation Script
# Usage: ./scripts/observe-ingestion.sh [command]

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

log_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Get DB connection
DB_CONTAINER="rafineri-postgres"
DB_USER="rafineri"
DB_NAME="rafineri"

# Function to query database
query_db() {
    docker compose exec -T postgres psql -U "$DB_USER" -d "$DB_NAME" -t -c "$1" 2>/dev/null || echo "N/A"
}

# Show current stats
show_stats() {
    log_info "Current Database Stats"
    echo "=========================="
    
    log_info "Stories count:"
    query_db "SELECT COUNT(*) FROM stories;"
    
    log_info "Items count:"
    query_db "SELECT COUNT(*) FROM items;"
    
    log_info "Story events count:"
    query_db "SELECT COUNT(*) FROM story_events;"
    
    log_info "Active sources:"
    query_db "SELECT type, COUNT(*) FROM sources WHERE is_active = 1 GROUP BY type;"
}

# Show recent stories
show_stories() {
    log_info "Recent Stories (last 10)"
    echo "=========================="
    query_db "SELECT id, title, canonical_url, first_seen_at, item_count FROM stories ORDER BY first_seen_at DESC LIMIT 10;"
}

# Show recent items
show_items() {
    log_info "Recent Items (last 10)"
    echo "=========================="
    query_db "SELECT id, title, source_type, external_id, posted_at FROM items ORDER BY posted_at DESC LIMIT 10;"
}

# Trigger manual ingestion
trigger_ingestion() {
    log_info "Triggering HackerNews ingestion..."
    
    # Generate admin token (SHA256 of admin:changeme)
    ADMIN_TOKEN="6baeda18c5c461cc8be4ce8007960d99e51045bbbd00fd7f26c976bd9427d8bb"
    
    response=$(curl -s -X POST \
        "http://localhost:3001/v1/admin/sources/trigger/hackernews" \
        -H "x-admin-token: $ADMIN_TOKEN" \
        -H "Accept: application/json" 2>&1)
    
    if echo "$response" | grep -q '"success":true'; then
        log_success "Ingestion triggered successfully!"
        echo "$response" | grep -o '"jobId":"[^"]*"' | head -1
        log_info "Check worker logs in a few seconds to see processing..."
    else
        log_error "Failed to trigger ingestion:"
        echo "$response"
    fi
}

# Watch worker logs
watch_logs() {
    log_info "Watching worker logs (Ctrl+C to exit)..."
    docker compose logs -f worker --tail 50
}

# Watch real-time stats
watch_stats() {
    log_info "Watching stats (updates every 5 seconds, Ctrl+C to exit)..."
    while true; do
        clear
        show_stats
        sleep 5
    done
}

# Show help
show_help() {
    echo "Rafineri Ingestion Observation Tool"
    echo "==================================="
    echo ""
    echo "Commands:"
    echo "  stats      - Show current database statistics"
    echo "  stories    - Show recent stories"
    echo "  items      - Show recent items"
    echo "  trigger    - Manually trigger HackerNews ingestion"
    echo "  logs       - Watch worker logs in real-time"
    echo "  watch      - Watch database stats updating every 5 seconds"
    echo "  help       - Show this help message"
    echo ""
    echo "Usage examples:"
    echo "  ./scripts/observe-ingestion.sh stats"
    echo "  ./scripts/observe-ingestion.sh trigger"
    echo "  ./scripts/observe-ingestion.sh watch"
    echo ""
    echo "Typical workflow to observe ingestion:"
    echo "  1. Run './scripts/observe-ingestion.sh stats' to see current state"
    echo "  2. Run './scripts/observe-ingestion.sh trigger' to start ingestion"
    echo "  3. Run './scripts/observe-ingestion.sh logs' in another terminal to watch processing"
    echo "  4. Run './scripts/observe-ingestion.sh stats' again to see results"
}

# Main command handler
case "${1:-help}" in
    stats)
        show_stats
        ;;
    stories)
        show_stories
        ;;
    items)
        show_items
        ;;
    trigger)
        trigger_ingestion
        ;;
    logs)
        watch_logs
        ;;
    watch)
        watch_stats
        ;;
    help|--help|-h|*)
        show_help
        ;;
esac
