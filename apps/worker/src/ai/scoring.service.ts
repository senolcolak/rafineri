import { Injectable, Logger } from '@nestjs/common';
import { OllamaService } from './ollama.service';

interface ScoringInput {
  title: string;
  content?: string;
  source: string;
  claims: string[];
  evidence?: Array<{
    url: string;
    title: string;
    stance: 'supporting' | 'contradicting' | 'neutral';
  }>;
}

interface ScoringResult {
  label: 'verified' | 'likely' | 'contested' | 'unverified';
  confidence: number;
  summary: string;
  reasons: string[];
  keyClaims: Array<{
    text: string;
    status: 'verified' | 'partially_verified' | 'unverified' | 'disputed';
    sources: string[];
  }>;
}

@Injectable()
export class ScoringService {
  private readonly logger = new Logger(ScoringService.name);

  constructor(private readonly ollamaService: OllamaService) {}

  /**
   * Score a story for verifiability using small model
   */
  async scoreStory(input: ScoringInput): Promise<ScoringResult> {
    try {
      const systemPrompt = `You are a news verification AI. Analyze the given story and determine its verifiability.

Respond in this exact JSON format:
{
  "label": "verified" | "likely" | "contested" | "unverified",
  "confidence": 0.0-1.0,
  "summary": "Brief 1-2 sentence assessment",
  "reasons": ["Reason 1", "Reason 2", "Reason 3"],
  "keyClaims": [
    {
      "text": "Claim text",
      "status": "verified" | "partially_verified" | "unverified" | "disputed",
      "sources": ["source1", "source2"]
    }
  ]
}

Guidelines:
- verified: Multiple credible sources confirm, strong evidence
- likely: Some evidence supports, credible sources but limited confirmation
- contested: Conflicting information exists, disputed by other sources
- unverified: Insufficient evidence, single source, or unknown credibility`;

      const prompt = this.buildScoringPrompt(input);
      
      const response = await this.ollamaService.generate(prompt, systemPrompt, {
        temperature: 0.2,
        maxTokens: 1024,
      });

      return this.parseScoringResponse(response);
    } catch (error) {
      this.logger.error({ err: error, input }, 'Scoring failed, falling back to rule-based');
      return this.fallbackScoring(input);
    }
  }

  /**
   * Quick credibility check for source/domain
   */
  async checkSourceCredibility(domain: string): Promise<{
    score: number;
    category: 'high' | 'medium' | 'low' | 'unknown';
    reasoning: string;
  }> {
    try {
      const systemPrompt = `You are a source credibility evaluator. Rate news sources on credibility.

Respond in this exact JSON format:
{
  "score": 0.0-1.0,
  "category": "high" | "medium" | "low" | "unknown",
  "reasoning": "Brief explanation"
}

Consider: editorial standards, fact-checking practices, transparency, history of accuracy.`;

      const prompt = `Rate the credibility of this news source: ${domain}

Provide your response in JSON format.`;

      const response = await this.ollamaService.generate(prompt, systemPrompt, {
        temperature: 0.1,
        maxTokens: 256,
      });

      return this.parseCredibilityResponse(response);
    } catch (error) {
      this.logger.warn({ err: error, domain }, 'Credibility check failed, using rules');
      return this.ruleBasedCredibility(domain);
    }
  }

  /**
   * Detect clickbait or sensationalism
   */
  async detectClickbait(title: string): Promise<{
    isClickbait: boolean;
    score: number;
    indicators: string[];
  }> {
    try {
      const systemPrompt = `You are a clickbait detection AI. Analyze headlines for sensationalism.

Respond in this exact JSON format:
{
  "isClickbait": true | false,
  "score": 0.0-1.0,
  "indicators": ["indicator1", "indicator2"]
}

Clickbait indicators: ALL CAPS, excessive punctuation, emotional manipulation, vague teasers, numbers without context.`;

      const prompt = `Analyze this headline for clickbait/sensationalism: "${title}"

Provide your response in JSON format.`;

      const response = await this.ollamaService.generate(prompt, systemPrompt, {
        temperature: 0.1,
        maxTokens: 256,
      });

      return this.parseClickbaitResponse(response);
    } catch (error) {
      this.logger.warn({ err: error, title }, 'Clickbait detection failed');
      return { isClickbait: false, score: 0.5, indicators: [] };
    }
  }

  private buildScoringPrompt(input: ScoringInput): string {
    const claims = input.claims.length > 0 
      ? input.claims.map((c, i) => `${i + 1}. ${c}`).join('\n')
      : 'No explicit claims extracted';

    const evidence = input.evidence && input.evidence.length > 0
      ? input.evidence.map(e => `- ${e.title} (${e.stance})`).join('\n')
      : 'No evidence collected';

    return `Analyze this news story for verifiability:

TITLE: ${input.title}

SOURCE: ${input.source}

CONTENT SUMMARY: ${input.content || 'Not provided'}

CLAIMS:
${claims}

EVIDENCE:
${evidence}

Provide your analysis in JSON format.`;
  }

  private parseScoringResponse(response: string): ScoringResult {
    try {
      // Extract JSON from response (in case there's extra text)
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        label: parsed.label || 'unverified',
        confidence: Math.max(0, Math.min(1, parsed.confidence || 0)),
        summary: parsed.summary || 'No summary available',
        reasons: parsed.reasons || [],
        keyClaims: parsed.keyClaims || [],
      };
    } catch (error) {
      this.logger.error({ err: error, response }, 'Failed to parse scoring response');
      throw error;
    }
  }

  private parseCredibilityResponse(response: string): {
    score: number;
    category: 'high' | 'medium' | 'low' | 'unknown';
    reasoning: string;
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        score: Math.max(0, Math.min(1, parsed.score || 0.5)),
        category: parsed.category || 'unknown',
        reasoning: parsed.reasoning || 'No reasoning provided',
      };
    } catch (error) {
      this.logger.error({ err: error, response }, 'Failed to parse credibility response');
      throw error;
    }
  }

  private parseClickbaitResponse(response: string): {
    isClickbait: boolean;
    score: number;
    indicators: string[];
  } {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in response');
      }

      const parsed = JSON.parse(jsonMatch[0]);

      return {
        isClickbait: parsed.isClickbait || false,
        score: Math.max(0, Math.min(1, parsed.score || 0)),
        indicators: parsed.indicators || [],
      };
    } catch (error) {
      this.logger.error({ err: error, response }, 'Failed to parse clickbait response');
      throw error;
    }
  }

  private ruleBasedCredibility(domain: string): {
    score: number;
    category: 'high' | 'medium' | 'low' | 'unknown';
    reasoning: string;
  } {
    const trustedDomains = [
      'reuters.com', 'ap.org', 'bbc.com', 'bbc.co.uk',
      'nytimes.com', 'wsj.com', 'washingtonpost.com',
      'economist.com', 'npr.org', 'pbs.org',
      'nature.com', 'science.org', 'ieee.org',
      'techcrunch.com', 'theverge.com', 'arstechnica.com',
    ];

    const lowCredibilityDomains = [
      'naturalnews.com', 'infowars.com', 'beforeitsnews.com',
      'yournewswire.com', 'activistpost.com',
    ];

    if (trustedDomains.some(d => domain.includes(d))) {
      return { score: 0.9, category: 'high', reasoning: 'Known reputable source' };
    }

    if (lowCredibilityDomains.some(d => domain.includes(d))) {
      return { score: 0.1, category: 'low', reasoning: 'Known low-credibility source' };
    }

    return { score: 0.5, category: 'unknown', reasoning: 'Source not in database' };
  }

  private fallbackScoring(input: ScoringInput): ScoringResult {
    // Rule-based fallback when AI fails
    const hasMultipleClaims = input.claims.length > 1;
    const hasEvidence = input.evidence && input.evidence.length > 0;
    
    let label: ScoringResult['label'] = 'unverified';
    let confidence = 0.3;

    if (hasEvidence && hasMultipleClaims) {
      label = 'likely';
      confidence = 0.6;
    } else if (hasEvidence) {
      label = 'likely';
      confidence = 0.5;
    }

    return {
      label,
      confidence,
      summary: 'Scored using rule-based fallback (AI unavailable)',
      reasons: ['AI service unavailable', 'Using heuristic scoring'],
      keyClaims: input.claims.map(text => ({
        text,
        status: 'unverified',
        sources: [],
      })),
    };
  }
}
