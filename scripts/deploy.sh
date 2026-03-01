#!/bin/bash
# =============================================================================
# Rafineri Production Deployment Script
# =============================================================================
# This script automates the deployment process on a Linux VM
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

COMPOSE_FILE="docker-compose.server.yml"

# Functions
log_info() {
    echo -e "${GREEN}[INFO]${NC} \$1"
}

log_warn() {
    echo -e "${YELLOW}[WARN]${NC} \$1"
}

log_error() {
    echo -e "${RED}[ERROR]${NC} \$1"
}

# Check if .env exists
check_env() {
    if [ ! -f .env ]; then
        log_warn ".env file not found!"
        echo ""
        echo "Please create one from the example:"
        echo "  cp .env.server.example .env"
        echo "  nano .env  # Edit with your settings"
        echo ""
        read -p "Continue with default settings? (y/N) " -n 1 -r
        echo
        if [[ ! \$REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check Docker is installed
check_docker() {
    if ! command -v docker &> /dev/null; then
        log_error "Docker is not installed!"
        echo "Please run: sudo bash scripts/install-docker.sh"
        exit 1
    fi
    
    if ! docker compose version &> /dev/null; then
        log_error "Docker Compose plugin not found!"
        exit 1
    fi
    
    log_info "Docker version: \$(docker --version)"
    log_info "Compose version: \$(docker compose version)"
}

# Pull latest code
update_code() {
    log_info "Pulling latest code..."
    git pull origin main || log_warn "Could not pull latest code"
}

# Build and deploy
deploy() {
    log_info "Building and starting services..."
    
    # Pull latest images for cache
    docker compose -f \$COMPOSE_FILE pull || true
    
    # Build with no cache to ensure fresh build
    docker compose -f \$COMPOSE_FILE build --no-cache
    
    # Start services
    docker compose -f \$COMPOSE_FILE up -d
    
    log_info "Deployment complete!"
}

# Check service health
check_health() {
    log_info "Checking service health..."
    
    sleep 5
    
    # Check each service
    services=("postgres" "redis" "api" "worker" "web")
    
    for service in "\${services[@]}"; do
        if docker compose -f \$COMPOSE_FILE ps | grep -q "rafineri-\$service"; then
            status=\$(docker compose -f \$COMPOSE_FILE ps | grep "rafineri-\$service" | awk '{print \$4}')
            if [[ "\$status" == "running" ]] || [[ "\$status" == "Up" ]]; then
                log_info "\$service is running"
            else
                log_warn "\$service status: \$status"
            fi
        else
            log_error "\$service container not found!"
        fi
    done
}

# Show logs
show_logs() {
    echo ""
    read -p "View logs? (y/N) " -n 1 -r
    echo
    if [[ \$REPLY =~ ^[Yy]$ ]]; then
        docker compose -f \$COMPOSE_FILE logs -f
    fi
}

# Print status
print_status() {
    echo ""
    echo "=== Deployment Status ==="
    docker compose -f \$COMPOSE_FILE ps
    echo ""
    echo "=== Useful Commands ==="
    echo "View logs:        docker compose -f \$COMPOSE_FILE logs -f"
    echo "View API logs:    docker compose -f \$COMPOSE_FILE logs -f api"
    echo "Restart services: docker compose -f \$COMPOSE_FILE restart"
    echo "Stop services:    docker compose -f \$COMPOSE_FILE down"
    echo "Update:           git pull && docker compose -f \$COMPOSE_FILE up -d --build"
    echo ""
    echo "=== Access Points ==="
    echo "Web UI:   http://\$(hostname -I | awk '{print \$1}'):3000"
    echo "API:      http://\$(hostname -I | awk '{print \$1}'):3001"
    echo ""
}

# Main
echo "=== Rafineri Deployment Script ==="
echo ""

check_env
check_docker
update_code
deploy
check_health
print_status
show_logs
