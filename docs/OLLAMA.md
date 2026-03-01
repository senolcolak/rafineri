# Rafineri Ollama Integration

This document describes how to set up and use Ollama (local AI) for news verification and approval in Rafineri.

## Overview

Rafineri can use [Ollama](https://ollama.com/) to run AI models locally for:

- **News verification scoring** - Automatically score stories for verifiability
- **Claim extraction** - Extract and analyze claims from articles
- **Source credibility** - Evaluate source trustworthiness
- **Clickbait detection** - Identify sensationalized content
- **Content approval** - AI-assisted news approval workflow

## Models

We use small, efficient models suitable for news analysis:

| Model | Size | Purpose |
|-------|------|---------|
| `llama3.2:3b` | 3B params | News verification, claim analysis, approval |
| `nomic-embed-text` | ~400MB | Text embeddings for similarity/clustering |

## Quick Start

### Docker Compose (Recommended)

```bash
# Setup Ollama and pull models
./scripts/setup-ollama.sh docker

# Start the complete stack with Ollama
docker compose -f docker-compose.yml -f docker-compose.ollama.yml up -d

# Check status
docker compose -f docker-compose.yml -f docker-compose.ollama.yml ps
```

### Kubernetes

```bash
# Setup Ollama in Kubernetes
./scripts/setup-ollama.sh k8s

# Or manually:
kubectl apply -f k8s/namespace.yaml
kubectl apply -f k8s/ollama-deployment.yaml
kubectl apply -f k8s/ollama-service.yaml
kubectl apply -f k8s/ollama-model-init.yaml
```

### Local Installation

```bash
# Install and setup Ollama locally
./scripts/setup-ollama.sh local

# Set environment variables
export OLLAMA_URL=http://localhost:11434
export USE_LOCAL_AI=true
export AI_MODEL=llama3.2:3b
export MOCK_MODE=false

# Start Rafineri
docker compose up -d
```

## Configuration

### Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `USE_LOCAL_AI` | `false` | Enable Ollama integration |
| `OLLAMA_URL` | `http://ollama:11434` | Ollama server URL |
| `AI_MODEL` | `llama3.2:3b` | Model for verification/approval |
| `EMBEDDING_MODEL` | `nomic-embed-text` | Model for embeddings |
| `MOCK_MODE` | `true` | Use mock data instead of AI |

### Example .env

```bash
# Disable mock mode to use real AI
MOCK_MODE=false

# Enable local AI
USE_LOCAL_AI=true
OLLAMA_URL=http://ollama:11434
AI_MODEL=llama3.2:3b
EMBEDDING_MODEL=nomic-embed-text

# Other Rafineri settings
RAFINERI_ADMIN=admin
RAFINERI_ADMIN_PASSWORD=secure-password
ADMIN_TOKEN=your-admin-token
```

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                        Rafineri Stack                        │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  ┌─────────┐    ┌─────────────┐    ┌─────────────────────┐ │
│  │   Web   │    │     API     │    │       Worker        │ │
│  │Frontend │───▶│   Server    │───▶│  (AI Integration)   │ │
│  └─────────┘    └─────────────┘    └─────────────────────┘ │
│                                         │                   │
│                                         ▼                   │
│                              ┌─────────────────────┐       │
│                              │   Ollama Server     │       │
│                              │  (llama3.2:3b)      │       │
│                              │  (nomic-embed-text) │       │
│                              └─────────────────────┘       │
│                                         │                   │
│                    ┌────────────────────┼────────────────┐ │
│                    ▼                    ▼                ▼ │
│              ┌──────────┐      ┌─────────────┐   ┌────────┐│
│              │Scoring   │      │  Approval   │   │Embeddings│
│              │Service   │      │  Workflow   │   │Service  │
│              └──────────┘      └─────────────┘   └────────┘│
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## How It Works

### 1. Story Ingestion

When a story is ingested from HackerNews or Reddit:

1. Content is stored in the database
2. A job is queued for AI scoring
3. Worker picks up the job and calls Ollama

### 2. AI Scoring

The scoring service sends the story to Ollama with a prompt like:

```
Analyze this news story for verifiability:

TITLE: {title}
SOURCE: {source}
CONTENT: {content}

Respond with JSON:
{
  "label": "verified" | "likely" | "contested" | "unverified",
  "confidence": 0.0-1.0,
  "summary": "Brief assessment",
  "reasons": ["reason1", "reason2"],
  "keyClaims": [...]
}
```

### 3. Approval Workflow

For admin approval, Ollama can:

- Cross-check claims against known facts
- Evaluate source credibility
- Detect potential misinformation
- Provide approval recommendations

## API Endpoints

### Admin Approval with AI

```bash
# Submit story for AI-powered approval
POST /api/v1/admin/approval/process
{
  "storyId": "123",
  "title": "Story Title",
  "claim": "Main claim to verify",
  "sources": ["source1", "source2"]
}

# Response includes AI analysis:
{
  "success": true,
  "data": {
    "storyId": "123",
    "approved": true,
    "confidence": 0.85,
    "status": "approved",
    "reason": "Cross-check verified + AI scoring positive",
    "checks": {
      "aiScore": {
        "label": "verified",
        "confidence": 0.88
      }
    }
  }
}
```

## Performance

### Hardware Requirements

| Deployment | RAM | CPU | GPU | Notes |
|------------|-----|-----|-----|-------|
| Development | 4GB | 2 cores | Optional | Works on CPU |
| Production | 8GB+ | 4 cores | 8GB VRAM | Faster inference |

### Typical Response Times

- `llama3.2:3b` on CPU: 5-15 seconds per story
- `llama3.2:3b` on GPU: 1-3 seconds per story
- Embeddings: <100ms per text chunk

## Troubleshooting

### Ollama not responding

```bash
# Check Ollama status
curl http://localhost:11434/api/tags

# Check logs
docker logs rafineri-ollama

# Restart Ollama
docker restart rafineri-ollama
```

### Model not found

```bash
# Pull the model manually
curl -X POST http://localhost:11434/api/pull \
  -H "Content-Type: application/json" \
  -d '{"name": "llama3.2:3b"}'
```

### Worker can't connect to Ollama

1. Verify `OLLAMA_URL` environment variable
2. Check network connectivity: `docker network ls`
3. Ensure services are on the same network

### Out of memory

1. Reduce model size: Use `llama3.2:1b` instead
2. Increase Docker memory limit
3. Use GPU acceleration if available

## Security Considerations

1. **Ollama runs locally** - No data leaves your infrastructure
2. **Model isolation** - Each deployment has its own models
3. **No API keys needed** - Unlike OpenAI/Anthropic
4. **Network isolation** - Ollama only accessible internally

## Advanced Configuration

### Custom Models

You can use other Ollama models by setting:

```bash
AI_MODEL=mistral:7b    # More capable, slower
AI_MODEL=phi3:mini     # Faster, less capable
AI_MODEL=gemma:2b      # Google's model
```

### GPU Acceleration

For Docker Compose with NVIDIA GPU:

```yaml
services:
  ollama:
    image: ollama/ollama:latest
    deploy:
      resources:
        reservations:
          devices:
            - driver: nvidia
              count: 1
              capabilities: [gpu]
```

For Kubernetes with GPU nodes:

```yaml
resources:
  limits:
    nvidia.com/gpu: 1
```

## Migration from External AI

To switch from OpenAI/Anthropic to Ollama:

1. Set `USE_LOCAL_AI=true`
2. Start Ollama service
3. Set `OPENAI_API_KEY=` (empty)
4. Restart worker

No code changes needed - the scoring service automatically uses Ollama when configured.

## References

- [Ollama Documentation](https://github.com/ollama/ollama)
- [llama3.2 Model](https://ollama.com/library/llama3.2)
- [nomic-embed-text Model](https://ollama.com/library/nomic-embed-text)
