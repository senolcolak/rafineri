#!/bin/bash
# Setup script for Ollama and required models

set -e

echo "🔧 Setting up Ollama for Rafineri..."

# Check if Docker is running
if ! docker info > /dev/null 2>&1; then
    echo "❌ Docker is not running. Please start Docker first."
    exit 1
fi

# Check if Ollama container exists
if docker ps | grep -q "rafineri-ollama"; then
    echo "✅ Ollama container is already running"
else
    echo "🚀 Starting Ollama container..."
    docker-compose -f docker-compose.yml -f docker-compose.ollama.yml up -d ollama
    
    # Wait for Ollama to be ready
    echo "⏳ Waiting for Ollama to be ready..."
    sleep 5
    
    until curl -s http://localhost:11434/api/tags > /dev/null 2>&1; do
        echo "   Still waiting..."
        sleep 2
    done
    
    echo "✅ Ollama is ready!"
fi

# Pull required models
echo "📦 Pulling AI models (this may take a while)..."

MODELS=(
    "llama3.2:3b"
    "nomic-embed-text"
)

for model in "${MODELS[@]}"; do
    echo "   Pulling $model..."
    curl -s -X POST http://localhost:11434/api/pull \
        -H "Content-Type: application/json" \
        -d "{\"name\": \"$model\", \"stream\": false}" > /dev/null
    echo "   ✅ $model ready"
done

echo ""
echo "🎉 Ollama setup complete!"
echo ""
echo "Available models:"
curl -s http://localhost:11434/api/tags | grep -o '"name":"[^"]*"' | cut -d'"' -f4
echo ""
echo "To start using AI features, run:"
echo "  export USE_LOCAL_AI=true"
echo "  docker-compose up -d"
