#!/bin/bash
# =============================================================================
# Rafineri Simple Monitoring Script
# =============================================================================
# Quick health check for all services
# =============================================================================

COMPOSE_FILE="docker-compose.server.yml"

echo "=== Rafineri Service Monitor ==="
echo ""
echo "--- Container Status ---"
docker compose -f \$COMPOSE_FILE ps

echo ""
echo "--- Resource Usage ---"
docker stats --no-stream --format "table {{.Container}}\t{{.CPUPerc}}\t{{.MemUsage}}\t{{.NetIO}}\t{{.PIDs}}"

echo ""
echo "--- Recent Logs (last 5 lines) ---"
for service in postgres redis api worker web; do
    echo ""
    echo ">>> \$service:"
    docker compose -f \$COMPOSE_FILE logs --tail=5 \$service 2>/dev/null || echo "  (no logs)"
done

echo ""
echo "=== Health Checks ==="

# Check API health
if curl -sf http://localhost:3001/health > /dev/null 2>&1; then
    echo "✓ API is healthy"
else
    echo "✗ API is not responding"
fi

# Check Web
if curl -sf http://localhost:3000 > /dev/null 2>&1; then
    echo "✓ Web is accessible"
else
    echo "✗ Web is not responding"
fi

# Check Redis
if docker compose -f \$COMPOSE_FILE exec -T redis redis-cli ping | grep -q "PONG"; then
    echo "✓ Redis is responding"
else
    echo "✗ Redis is not responding"
fi

# Check Postgres
if docker compose -f \$COMPOSE_FILE exec -T postgres pg_isready -U rafineri > /dev/null 2>&1; then
    echo "✓ PostgreSQL is ready"
else
    echo "✗ PostgreSQL is not ready"
fi

echo ""
echo "=== Done ==="
