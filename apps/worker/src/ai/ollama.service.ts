import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface OllamaGenerateRequest {
  model: string;
  prompt: string;
  system?: string;
  stream?: boolean;
  options?: {
    temperature?: number;
    top_p?: number;
    top_k?: number;
    num_predict?: number;
  };
}

interface OllamaGenerateResponse {
  model: string;
  created_at: string;
  response: string;
  done: boolean;
  context?: number[];
  total_duration?: number;
  load_duration?: number;
  prompt_eval_count?: number;
  prompt_eval_duration?: number;
  eval_count?: number;
  eval_duration?: number;
}

interface OllamaEmbeddingRequest {
  model: string;
  prompt: string;
}

interface OllamaEmbeddingResponse {
  embedding: number[];
}

@Injectable()
export class OllamaService {
  private readonly logger = new Logger(OllamaService.name);
  private readonly baseUrl: string;
  private readonly model: string;
  private readonly embeddingModel: string;
  private readonly timeoutMs: number;

  constructor(private readonly configService: ConfigService) {
    this.baseUrl = this.configService.get('OLLAMA_URL', 'http://localhost:11434');
    this.model = this.configService.get('AI_MODEL', 'llama3.2:3b');
    this.embeddingModel = this.configService.get('EMBEDDING_MODEL', 'nomic-embed-text');
    const fallbackTimeout = this.configService.get('AI_REQUEST_TIMEOUT_MS', '15000');
    const timeoutRaw = this.configService.get('OLLAMA_TIMEOUT_MS', fallbackTimeout);
    this.timeoutMs = parseInt(timeoutRaw, 10) || 15000;
  }

  /**
   * Generate text completion using Ollama
   */
  async generate(
    prompt: string,
    systemPrompt?: string,
    options: { temperature?: number; maxTokens?: number } = {},
  ): Promise<string> {
    try {
      const request: OllamaGenerateRequest = {
        model: this.model,
        prompt,
        system: systemPrompt,
        stream: false,
        options: {
          temperature: options.temperature ?? 0.3,
          num_predict: options.maxTokens ?? 512,
        },
      };

      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/generate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama API error: ${error}`);
      }

      const data: OllamaGenerateResponse = await response.json();
      
      this.logger.debug(
        {
          model: this.model,
          promptTokens: data.prompt_eval_count,
          completionTokens: data.eval_count,
          duration: data.total_duration ? Math.round(data.total_duration / 1e6) : undefined,
        },
        'Ollama generation completed',
      );

      return data.response.trim();
    } catch (error) {
      this.logger.error({ err: error }, 'Ollama generation failed');
      throw error;
    }
  }

  /**
   * Generate embeddings for text
   */
  async embed(text: string): Promise<number[]> {
    try {
      const request: OllamaEmbeddingRequest = {
        model: this.embeddingModel,
        prompt: text,
      };

      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/embeddings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(request),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Ollama embedding error: ${error}`);
      }

      const data: OllamaEmbeddingResponse = await response.json();
      return data.embedding;
    } catch (error) {
      this.logger.error({ err: error }, 'Ollama embedding failed');
      throw error;
    }
  }

  /**
   * Check if Ollama is available and model is loaded
   */
  async healthCheck(): Promise<{ healthy: boolean; model: string; error?: string }> {
    try {
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/tags`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });

      if (!response.ok) {
        return { healthy: false, model: this.model, error: 'Ollama server not responding' };
      }

      const data = await response.json();
      const models = data.models || [];
      const hasModel = models.some((m: any) => m.name === this.model);

      if (!hasModel) {
        return { 
          healthy: false, 
          model: this.model, 
          error: `Model ${this.model} not found. Run: ollama pull ${this.model}` 
        };
      }

      return { healthy: true, model: this.model };
    } catch (error) {
      return { 
        healthy: false, 
        model: this.model, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      };
    }
  }

  /**
   * Pull a model (for setup)
   */
  async pullModel(modelName?: string): Promise<void> {
    const model = modelName || this.model;
    
    try {
      this.logger.log({ model }, 'Pulling Ollama model...');
      
      const response = await this.fetchWithTimeout(`${this.baseUrl}/api/pull`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: model, stream: false }),
      });

      if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to pull model: ${error}`);
      }

      this.logger.log({ model }, 'Model pulled successfully');
    } catch (error) {
      this.logger.error({ err: error, model }, 'Failed to pull model');
      throw error;
    }
  }

  private async fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.timeoutMs);

    try {
      return await fetch(url, {
        ...init,
        signal: controller.signal,
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        throw new Error(`Ollama request timed out after ${this.timeoutMs}ms`);
      }
      throw error;
    } finally {
      clearTimeout(timeoutId);
    }
  }
}
