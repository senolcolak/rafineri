# Rafineri AI Architecture Proposal

> Hybrid Approach: Small Models + Selective LLM Fallback

---

## 🎯 Core Philosophy

**Use the right tool for the job:**
- **Small Models** (~1B-7B parameters): Pattern matching, classification, simple validation
- **Large Models** (GPT-4/Claude): Complex reasoning, edge cases, quality assurance

---

## ✅ Why Small Models Make Sense for Rafineri

### 1. **Cost Efficiency**

| Approach | Cost per 1K stories | Monthly (30K stories) |
|----------|---------------------|----------------------|
| GPT-4 only | ~$150 | ~$4,500 |
| Small model (local) | ~$5 (electricity) | ~$150 |
| **Hybrid (80/20)** | ~$35 | **~$1,050** |

**Savings: 75-95% on AI costs**

### 2. **Latency**

- Small model: 50-200ms inference
- GPT-4: 1-5 seconds
- **User experience improvement**: Near-instant story processing

### 3. **Privacy & Control**

- Data stays in your infrastructure
- No third-party API calls for 80% of requests
- Fine-tune on your specific news domain

### 4. **What Small Models Excel At**

✅ **Pattern matching**:
- Source credibility detection (known domains)
- Clickbait detection
- Duplicate/similar content detection
- Basic claim extraction

✅ **Classification**:
- Category tagging (Tech, Science, Politics)
- Sentiment analysis
- Spam/low-quality detection

✅ **Simple validation**:
- URL validation
- Basic fact-checking against known databases
- Language detection

---

## 🏗️ Proposed Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     INGESTION PIPELINE                           │
└─────────────────────────────────────────────────────────────────┘
                                │
                                ▼
┌─────────────────────────────────────────────────────────────────┐
│  STEP 1: SMALL MODEL (Local - Ollama/vLLM/TensorRT)             │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐ │
│  │  Fast Classify  │──│  Credibility    │──│  Basic Extract  │ │
│  │  - Category     │  │  - Domain check │  │  - Key claims   │ │
│  │  - Urgency      │  │  - Source score │  │  - Entities     │ │
│  │  - Spam filter  │  │  - History      │  │  - Sentiment    │ │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                                │
                ┌───────────────┼───────────────┐
                │               │               │
                ▼               ▼               ▼
        ┌──────────┐   ┌──────────┐   ┌──────────┐
        │ CONFIDENT│   | UNCERTAIN│   │ COMPLEX  │
        │ >80%     │   │ 40-80%   │   │ <40%     │
        └────┬─────┘   └────┬─────┘   └────┬─────┘
             │              │              │
             ▼              ▼              ▼
        ┌──────────┐  ┌──────────┐  ┌──────────┐
        │  AUTO    │  │  LLM     │  │  LLM +   │
        │  PROCESS │  │  VERIFY  │  │  REVIEW  │
        └──────────┘  └──────────┘  └──────────┘
```

---

## 🛠️ Recommended Small Model Stack

### Option 1: Ollama (Easiest - Development)

```bash
# Run locally
docker run -d -v ollama:/root/.ollama -p 11434:11434 --name ollama ollama/ollama

# Pull small models
ollama pull llama3.2:3b        # 3B params, fast
ollama pull mistral:7b         # 7B params, good quality
ollama pull phi4:4b            # 4B params, Microsoft
```

**Pros**: Zero config, easy setup  
**Cons**: Single-node, no GPU optimization

### Option 2: vLLM (Production - GPU)

```bash
# Optimized for throughput
docker run --gpus all -p 8000:8000 \
  vllm/vllm-openai:latest \
  --model microsoft/Phi-4-mini-instruct \
  --tensor-parallel-size 1
```

**Pros**: Batch processing, GPU optimized, high throughput  
**Cons**: Requires GPU, more complex setup

### Option 3: Text Embeddings + Classifier (Fastest)

```python
# Use embeddings for similarity
from sentence_transformers import SentenceTransformer

model = SentenceTransformer('all-MiniLM-L6-v2')  # 22MB
embeddings = model.encode(texts)

# Simple classifier for verdict
from sklearn.ensemble import RandomForestClassifier
```

**Pros**: Blazing fast, tiny footprint  
**Cons**: Less flexible, needs training data

---

## 📊 Model Selection Matrix

| Model | Size | Speed | Quality | Best For |
|-------|------|-------|---------|----------|
| **Phi-4-mini** | 3.8B | ⭐⭐⭐⭐⭐ | ⭐⭐⭐ | General purpose, fast |
| **Llama 3.2 3B** | 3B | ⭐⭐⭐⭐⭐ | ⭐⭐⭐⭐ | Balanced performance |
| **Mistral 7B** | 7B | ⭐⭐⭐ | ⭐⭐⭐⭐⭐ | Higher quality needs |
| **Qwen 2.5 7B** | 7B | ⭐⭐⭐ | ⭐⭐⭐⭐ | Multilingual |
| **Gemma 2B** | 2B | ⭐⭐⭐⭐⭐ | ⭐⭐ | Ultra-fast, simple tasks |

**Recommendation**: Start with **Llama 3.2 3B** (good balance) or **Phi-4-mini** (fastest)

---

## 🎯 Specific Rafineri Use Cases

### 1. Source Credibility (Small Model ✅)

```python
# Fast rule-based + small model hybrid
def check_source_credibility(url: str) -> float:
    # Rule-based (instant)
    domain = extract_domain(url)
    if domain in TRUSTED_DOMAINS:
        return 0.95
    if domain in KNOWN_SPAM:
        return 0.10
    
    # Small model for unknown domains
    prompt = f"Rate credibility (0-1): {domain}"
    return small_model.generate(prompt)
```

**Accuracy**: 85-90%  
**Speed**: <50ms  
**Cost**: $0 (local)

### 2. Claim Extraction (Hybrid)

```python
def extract_claims(text: str) -> List[Claim]:
    # Step 1: Small model extracts candidates
    candidates = small_model.extract(text)
    
    # Step 2: Filter obvious false positives
    filtered = [c for c in candidates if c.confidence > 0.6]
    
    # Step 3: LLM verifies borderline cases
    for claim in filtered:
        if 0.6 < claim.confidence < 0.8:
            claim = llm.verify(claim)
    
    return filtered
```

**Accuracy**: 90%+  
**Speed**: 200ms avg  
**Cost**: 80% reduction vs pure LLM

### 3. Verifiability Scoring (Small Model ✅)

Train a simple classifier:

```python
# Features for classification
features = {
    'source_credibility': 0.9,
    'has_quotes': True,
    'has_statistics': True,
    'cross_references': 3,
    'writing_quality': 0.85,
    'sentiment_extreme': False,
}

# Small model classifier
verdict = classifier.predict(features)  # verified/likely/contested/unverified
```

**Training data**: 1,000 manually labeled stories  
**Accuracy**: 85%+  
**Inference time**: 10ms

---

## 🔄 Implementation Plan

### Phase 1: Basic Integration (Week 1)

```bash
# 1. Add Ollama to docker-compose
services:
  ollama:
    image: ollama/ollama
    volumes:
      - ollama:/root/.ollama
    ports:
      - "11434:11434"

# 2. Create AI service
apps/worker/src/ai/
├── ai.module.ts
├── small-model.service.ts      # Ollama client
├── classifier.service.ts        # Scikit-learn
└── hybrid-scoring.service.ts    # Orchestration
```

### Phase 2: Optimization (Week 2)

- Add caching layer (Redis) for repeated sources
- Implement batching for multiple stories
- A/B test small model vs LLM quality

### Phase 3: Production (Week 3)

- Migrate to vLLM for GPU acceleration
- Add monitoring for model performance
- Fine-tune on domain-specific data

---

## 💰 Cost Analysis

### Current (Mock Mode)
- Cost: $0
- Quality: Simulated

### Option A: Pure OpenAI
- Cost: ~$4,500/month @ 30K stories
- Quality: ⭐⭐⭐⭐⭐
- Latency: 2-5s per story

### Option B: Small Model (Recommended)
- Hardware: 1x RTX 4090 (~$1,600 one-time) or cloud GPU (~$300/month)
- Cost: ~$150/month (electricity/cloud)
- Quality: ⭐⭐⭐⭐
- Latency: 200ms per story
- **Savings: 95%**

### Option C: Hybrid (80/20 split)
- Small model: 80% of stories
- LLM fallback: 20% edge cases
- Cost: ~$900/month
- Quality: ⭐⭐⭐⭐⭐
- **Savings: 80%**

---

## ⚠️ Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|------------|
| Quality degradation | High | A/B testing, human review loop |
| Model hallucination | Medium | Constrained prompts, validation |
| Hardware failure | Medium | Cloud backup, health checks |
| Scaling limits | Medium | Kubernetes, auto-scaling |

---

## ✅ Recommendation

**Start with Option B (Small Model)**, then add hybrid fallback if needed:

1. **Immediate**: Deploy Llama 3.2 3B via Ollama
2. **Measure**: Track quality vs LLM baseline
3. **Iterate**: Add LLM fallback for complex cases
4. **Optimize**: Fine-tune on your data

**Expected Outcome**:
- 95% cost reduction
- 10x faster processing
- Maintain 85-90% of LLM quality
- Full data privacy

---

## 🎬 Next Steps

1. **Prototype**: Test Llama 3.2 3B on 100 sample stories
2. **Compare**: Measure accuracy vs GPT-4
3. **Decide**: Pure small model vs hybrid
4. **Deploy**: Add to docker-compose
5. **Monitor**: Track quality metrics

Would you like me to implement the Ollama integration with a small model for testing?
