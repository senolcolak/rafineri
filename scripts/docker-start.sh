#!/bin/bash
# =============================================================================
# Rafineri Docker Compose Quick Start Script
# =============================================================================
# Usage: ./scripts/docker-start.sh [standard|ollama|full]
#
# Modes:
#   standard - Standard stack without AI (default)
#   ollama   - Stack with Ollama AI extension
#   full     - Complete stack with Ollama (ollama-full.yml)
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

MODE="${1:-standard}"

cd "$PROJECT_ROOT"

echo "🚀 Rafineri Docker Compose Starter"
echo "==================================="
echo "Mode: $MODE"
echo ""

# Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

case "$MODE" in
  standard)
    echo "📋 Starting standard stack..."
    echo "   Services: postgres, redis, api, worker, web"
    docker compose down
    docker compose up -d --build
    echo ""
    echo -e "${GREEN}✅ Standard stack started!${NC}"
    echo ""
    echo "Access points:"
    echo "  - Web UI:    http://localhost:3000"
    echo "  - API:       http://localhost:3001"
    echo "  - Admin:     http://localhost:3000/admin-login"
    echo ""
    echo "View logs:"
    echo "  docker compose logs -f"
    ;;
    
  ollama)
    echo "🤖 Starting stack with Ollama AI..."
    echo "   Services: postgres, redis, ollama, api, worker, web"
    echo ""
    echo -e "${YELLOW}⚠️  First run will download AI models (~2.5GB)${NC}"
    echo "   This may take 5-10 minutes..."
    echo ""
    docker compose -f docker-compose.yml -f docker-compose.ollama.yml down
    docker compose -f docker-compose.yml -f docker-compose.ollama.yml up -d --build
    echo ""
    echo -e "${GREEN}✅ Ollama stack started!${NC}"
    echo ""
    echo "Access points:"
    echo "  - Web UI:    http://localhost:3000"
    echo "  - API:       http://localhost:3001"
    echo "  - Ollama:    http://localhost:11434"
    echo ""
    echo "View logs:"
    echo "  docker compose -f docker-compose.yml -f docker-compose.ollama.yml logs -f"
    ;;
    
  full)
    echo "🤖 Starting complete Ollama stack (single file)..."
    echo "   Services: postgres, redis, ollama, api, worker, web"
    echo ""
    echo -e "${YELLOW}⚠️  First run will download AI models (~2.5GB)${NC}"
    echo "   This may take 5-10 minutes..."
    echo ""
    docker compose -f docker-compose.ollama-full.yml down
    docker compose -f docker-compose.ollama-full.yml up -d --build
    echo ""
    echo -e "${GREEN}✅ Full Ollama stack started!${NC}"
    echo ""
    echo "Access points:"
    echo "  - Web UI:    http://localhost:3000"
    echo "  - API:       http://localhost:3001"
    echo "  - Ollama:    http://localhost:11434"
    echo ""
    echo "View logs:"
    echo "  docker compose -f docker-compose.ollama-full.yml logs -f"
    ;;
    
  *)
    echo "Usage: $0 [standard|ollama|full]"
    echo ""
    echo "Modes:"
    echo "  standard - Standard stack without AI (default)"
    echo "  ollama   - Stack with Ollama AI extension"
    echo "  full     - Complete stack with Ollama (single file)"
    exit 1
    ;;
esac

echo ""
echo "📊 Check service status:"
echo "  docker compose ps"
echo ""
echo "🛑 To stop:"
echo "  docker compose down"
