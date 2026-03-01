#!/bin/bash
# =============================================================================
# Rafineri Ollama Setup Script
# =============================================================================
# This script sets up Ollama with the required AI models for news verification.
#
# Usage:
#   ./scripts/setup-ollama.sh [docker|k8s|local]
#
# Modes:
#   docker - Setup Ollama in Docker Compose (default)
#   k8s    - Setup Ollama in Kubernetes
#   local  - Setup local Ollama installation
# =============================================================================

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"

MODE="${1:-docker}"
MODELS=("llama3.2:3b" "nomic-embed-text")

echo "🔧 Rafineri Ollama Setup"
echo "=========================="
echo "Mode: $MODE"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

log_info() {
    echo -e "${GREEN}✓${NC} $1"
}

log_warn() {
    echo -e "${YELLOW}⚠${NC} $1"
}

log_error() {
    echo -e "${RED}✗${NC} $1"
}

# =============================================================================
# Docker Compose Setup
# =============================================================================
setup_docker() {
    echo "🐳 Setting up Ollama with Docker Compose..."
    
    cd "$PROJECT_ROOT"
    
    # Check if Docker is running
    if ! docker info > /dev/null 2>&1; then
        log_error "Docker is not running. Please start Docker first."
        exit 1
    fi
    
    # Copy ollama env if not exists
    if [ ! -f ".env" ]; then
        if [ -f ".env.ollama.example" ]; then
            cp .env.ollama.example .env
            log_info "Created .env from .env.ollama.example"
            log_warn "Please edit .env and set secure passwords!"
        fi
    fi
    
    # Start Ollama service
    echo ""
    echo "🚀 Starting Ollama service..."
    docker compose -f docker-compose.yml -f docker-compose.ollama.yml up -d ollama
    
    # Wait for Ollama to be ready
    echo ""
    echo "⏳ Waiting for Ollama to be ready..."
    sleep 5
    
    until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
        echo "   Still waiting..."
        sleep 2
    done
    
    log_info "Ollama is ready!"
    
    # Pull models
    echo ""
    echo "📦 Pulling AI models..."
    for model in "${MODELS[@]}"; do
        echo ""
        echo "   Downloading $model..."
        curl -s -X POST http://localhost:11434/api/pull \
            -H "Content-Type: application/json" \
            -d "{\"name\": \"$model\", \"stream\": false}"
        log_info "$model ready"
    done
    
    echo ""
    log_info "Ollama setup complete!"
    echo ""
    echo "Available models:"
    curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | cut -d'"' -f4 | sed 's/^/  - /'
    echo ""
    echo "To start the full stack with AI:"
    echo "  docker compose -f docker-compose.yml -f docker-compose.ollama.yml up -d"
}

# =============================================================================
# Kubernetes Setup
# =============================================================================
setup_k8s() {
    echo "☸️  Setting up Ollama in Kubernetes..."
    
    cd "$PROJECT_ROOT"
    
    # Check if kubectl is available
    if ! command -v kubectl &> /dev/null; then
        log_error "kubectl not found. Please install kubectl first."
        exit 1
    fi
    
    # Check cluster connection
    if ! kubectl cluster-info > /dev/null 2>&1; then
        log_error "Cannot connect to Kubernetes cluster."
        exit 1
    fi
    
    # Apply namespace first
    echo ""
    echo "📋 Creating namespace..."
    kubectl apply -f k8s/namespace.yaml
    log_info "Namespace 'rafineri' created"
    
    # Create secrets from template if secrets.yaml exists
    if [ -f "k8s/secrets.yaml" ]; then
        echo ""
        echo "🔐 Applying secrets..."
        kubectl apply -f k8s/secrets.yaml
        log_info "Secrets applied"
    else
        echo ""
        log_warn "k8s/secrets.yaml not found"
        echo "    Copy k8s/secrets-template.yaml to k8s/secrets.yaml and configure"
        echo "    Or run: kubectl create secret generic rafineri-secrets -n rafineri \\"
        echo "      --from-literal=postgres-password=yourpassword \\"
        echo "      --from-literal=admin-token=yourtoken"
    fi
    
    # Deploy Ollama
    echo ""
    echo "🚀 Deploying Ollama..."
    kubectl apply -f k8s/ollama-deployment.yaml
    kubectl apply -f k8s/ollama-service.yaml
    log_info "Ollama deployment started"
    
    # Wait for Ollama to be ready
    echo ""
    echo "⏳ Waiting for Ollama to be ready..."
    kubectl wait --for=condition=ready pod -l app=ollama -n rafineri --timeout=300s
    log_info "Ollama is ready!"
    
    # Pull models
    echo ""
    echo "📦 Pulling AI models..."
    for model in "${MODELS[@]}"; do
        echo "   Downloading $model..."
        kubectl exec -n rafineri deployment/ollama -- ollama pull "$model"
        log_info "$model ready"
    done
    
    echo ""
    log_info "Ollama setup complete!"
    echo ""
    echo "To check available models:"
    echo "  kubectl exec -n rafineri deployment/ollama -- ollama list"
    echo ""
    echo "To deploy the full Rafineri stack:"
    echo "  kubectl apply -f k8s/rafineri-with-ollama.yaml"
    echo ""
    echo "To port-forward Ollama for local access:"
    echo "  kubectl port-forward svc/ollama 11434:11434 -n rafineri"
}

# =============================================================================
# Local Setup
# =============================================================================
setup_local() {
    echo "💻 Setting up local Ollama installation..."
    
    # Check if Ollama is installed
    if ! command -v ollama &> /dev/null; then
        log_warn "Ollama not found. Installing..."
        
        # macOS
        if [[ "$OSTYPE" == "darwin"* ]]; then
            if command -v brew &> /dev/null; then
                brew install ollama
            else
                log_error "Homebrew not found. Please install Ollama manually:"
                echo "  https://ollama.com/download"
                exit 1
            fi
        # Linux
        elif [[ "$OSTYPE" == "linux-gnu"* ]]; then
            curl -fsSL https://ollama.com/install.sh | sh
        else
            log_error "Unsupported OS. Please install Ollama manually:"
            echo "  https://ollama.com/download"
            exit 1
        fi
    fi
    
    log_info "Ollama is installed"
    
    # Start Ollama service if not running
    if ! curl -s http://localhost:11434/api/tags > /dev/null 2>&1; then
        echo ""
        echo "🚀 Starting Ollama service..."
        ollama serve &
        OLLAMA_PID=$!
        
        # Wait for Ollama to be ready
        echo "⏳ Waiting for Ollama to be ready..."
        sleep 5
        until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
            echo "   Still waiting..."
            sleep 2
        done
        log_info "Ollama is ready (PID: $OLLAMA_PID)"
    else
        log_info "Ollama is already running"
    fi
    
    # Pull models
    echo ""
    echo "📦 Pulling AI models..."
    for model in "${MODELS[@]}"; do
        echo "   Downloading $model..."
        ollama pull "$model"
        log_info "$model ready"
    done
    
    echo ""
    log_info "Local Ollama setup complete!"
    echo ""
    echo "Available models:"
    ollama list | tail -n +2 | sed 's/^/  - /'
    echo ""
    echo "Ollama is running at: http://localhost:11434"
    echo ""
    echo "To stop Ollama:"
    echo "  pkill ollama"
}

# =============================================================================
# Main
# =============================================================================
case "$MODE" in
    docker)
        setup_docker
        ;;
    k8s|kubernetes)
        setup_k8s
        ;;
    local)
        setup_local
        ;;
    *)
        echo "Usage: $0 [docker|k8s|local]"
        echo ""
        echo "Modes:"
        echo "  docker - Setup Ollama with Docker Compose (default)"
        echo "  k8s    - Setup Ollama in Kubernetes"
        echo "  local  - Setup local Ollama installation"
        exit 1
        ;;
esac

echo ""
echo "🎉 Setup complete!"
