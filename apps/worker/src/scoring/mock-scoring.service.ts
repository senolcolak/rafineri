import { Injectable, Logger } from '@nestjs/common';

export type ScoreLabel = 'verified' | 'likely' | 'contested' | 'unverified';

export interface ScoreResult {
  storyId: string;
  summary: string;
  label: ScoreLabel;
  confidence: number;
  reasons: string[];
  claims: {
    text: string;
    type: string;
    confidence: number;
  }[];
  evidence: {
    claimText: string;
    source: string;
    url: string;
    text: string;
    supports: boolean;
    confidence: number;
  }[];
}

interface Story {
  id: string;
  title: string;
  canonicalUrl: string;
  itemCount: number;
  sources: string[];
}

@Injectable()
export class MockScoringService {
  private readonly logger = new Logger(MockScoringService.name);

  /**
   * Generate deterministic mock score based on story title hash
   * This ensures the same story always gets the same score for testing
   */
  score(story: Story): ScoreResult {
    const hash = this.hashString(story.title);
    const normalizedHash = hash / 0xFFFFFFFF; // Normalize to 0-1

    // Determine label based on hash ranges
    let label: ScoreLabel;
    if (normalizedHash < 0.25) {
      label = 'verified';
    } else if (normalizedHash < 0.50) {
      label = 'likely';
    } else if (normalizedHash < 0.75) {
      label = 'contested';
    } else {
      label = 'unverified';
    }

    // Confidence varies inversely with how close to boundary
    const confidence = 0.5 + (Math.abs((normalizedHash % 0.25) - 0.125) / 0.125) * 0.5;

    // Generate summary based on label
    const summary = this.generateSummary(story, label, confidence);

    // Generate reasons
    const reasons = this.generateReasons(story, label, normalizedHash);

    // Generate claims
    const claims = this.generateClaims(story, normalizedHash);

    // Generate evidence
    const evidence = this.generateEvidence(claims, normalizedHash);

    this.logger.debug(`Mock score for "${story.title.substring(0, 50)}...": ${label} (${confidence.toFixed(2)})`);

    return {
      storyId: story.id,
      summary,
      label,
      confidence: Math.round(confidence * 100) / 100,
      reasons,
      claims,
      evidence,
    };
  }

  /**
   * Simple string hash function (FNV-1a variant)
   * Produces deterministic output for the same input
   */
  private hashString(str: string): number {
    let hash = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      hash ^= str.charCodeAt(i);
      hash = Math.imul(hash, 0x01000193);
    }
    return hash >>> 0; // Convert to unsigned 32-bit
  }

  private generateSummary(story: Story, label: ScoreLabel, confidence: number): string {
    const summaries: Record<ScoreLabel, string[]> = {
      verified: [
        `Multiple authoritative sources confirm the claims in this story. The information appears well-sourced and consistent across publications.`,
        `This story is supported by primary sources and official documentation. Cross-referencing confirms the key facts.`,
        `Established news organizations have independently verified the core claims of this story.`,
      ],
      likely: [
        `Available evidence strongly suggests the claims are accurate, though some details remain unverified by independent sources.`,
        `The story is consistent with known facts and credible reporting, but lacks complete independent confirmation.`,
        `Preliminary verification indicates the information is probably accurate, pending further confirmation.`,
      ],
      contested: [
        `Conflicting reports and disputed claims make this story difficult to verify. Multiple perspectives exist.`,
        `Different sources present contradictory information about key aspects of this story.`,
        `The claims in this story are disputed by some credible sources, creating uncertainty about accuracy.`,
      ],
      unverified: [
        `Insufficient credible sources available to verify the claims in this story.`,
        `The information presented cannot be independently verified at this time.`,
        `This story appears to be based on limited or unconfirmed sources. Exercise caution.`,
      ],
    };

    const hash = this.hashString(story.title + 'summary');
    const options = summaries[label];
    return options[hash % options.length];
  }

  private generateReasons(story: Story, label: ScoreLabel, hash: number): string[] {
    const reasonPools: Record<ScoreLabel, string[]> = {
      verified: [
        'Multiple independent sources report the same information',
        'Primary source documentation is available',
        'Claims are consistent with established facts',
        'Reporting from established news organizations',
        'Official statements corroborate the story',
      ],
      likely: [
        'Sources appear credible but limited in number',
        'Information aligns with known patterns',
        'Some independent confirmation exists',
        'Context supports the reported claims',
        'No contradictory evidence found',
      ],
      contested: [
        'Conflicting reports from different sources',
        'Some sources dispute key claims',
        'Missing context creates ambiguity',
        'Differing interpretations of the same facts',
        'Unclear which sources are authoritative',
      ],
      unverified: [
        'Limited source diversity',
        'No primary sources identified',
        'Claims cannot be independently checked',
        'Source reliability unclear',
        'Insufficient information available',
      ],
    };

    const allReasons = reasonPools[label];
    const numReasons = 2 + Math.floor(hash * 10) % 3; // 2-4 reasons
    const reasons: string[] = [];

    for (let i = 0; i < numReasons && i < allReasons.length; i++) {
      const index = (Math.floor(hash * 100) + i) % allReasons.length;
      const reason = allReasons[index];
      if (!reasons.includes(reason)) {
        reasons.push(reason);
      }
    }

    return reasons;
  }

  private generateClaims(story: Story, hash: number): { text: string; type: string; confidence: number }[] {
    // Extract potential claims from title or generate generic ones
    const titleWords = story.title.split(' ').filter(w => w.length > 3);
    
    const claimTypes = ['fact', 'statement', 'prediction', 'quote'];
    const claims: { text: string; type: string; confidence: number }[] = [];

    const numClaims = 1 + Math.floor(hash * 100) % 3;

    for (let i = 0; i < numClaims; i++) {
      const claimHash = this.hashString(story.title + `claim${i}`);
      const normalizedClaimHash = claimHash / 0xFFFFFFFF;
      
      // Generate claim text based on title words
      const wordIndex = (Math.floor(claimHash) % Math.max(1, titleWords.length - 2));
      const claimWords = titleWords.slice(wordIndex, wordIndex + 3);
      
      let text: string;
      if (claimWords.length >= 2) {
        text = `Story claims: "${claimWords.join(' ')}..."`;
      } else {
        const genericClaims = [
          'An event has occurred as described',
          'The reported figures are accurate',
          'The attributed statements are genuine',
          'The timeline presented is correct',
        ];
        text = genericClaims[claimHash % genericClaims.length];
      }

      claims.push({
        text,
        type: claimTypes[claimHash % claimTypes.length],
        confidence: 0.5 + (normalizedClaimHash * 0.5),
      });
    }

    return claims;
  }

  private generateEvidence(
    claims: { text: string }[], 
    hash: number
  ): { claimText: string; source: string; url: string; text: string; supports: boolean; confidence: number }[] {
    const sources = [
      { name: 'Associated Press', domain: 'apnews.com' },
      { name: 'Reuters', domain: 'reuters.com' },
      { name: 'BBC News', domain: 'bbc.com' },
      { name: 'The Guardian', domain: 'theguardian.com' },
      { name: 'Official Statement', domain: 'gov' },
      { name: 'Research Paper', domain: 'doi.org' },
      { name: 'Company Blog', domain: 'medium.com' },
    ];

    const evidence: { claimText: string; source: string; url: string; text: string; supports: boolean; confidence: number }[] = [];

    for (const claim of claims) {
      const numEvidence = 1 + Math.floor(hash * 10) % 2;

      for (let i = 0; i < numEvidence; i++) {
        const evHash = this.hashString(claim.text + `ev${i}`);
        const normalizedEvHash = evHash / 0xFFFFFFFF;
        const source = sources[evHash % sources.length];

        evidence.push({
          claimText: claim.text,
          source: source.name,
          url: `https://${source.domain}/article/${Math.abs(evHash).toString(36)}`,
          text: `Source ${normalizedEvHash > 0.5 ? 'confirms' : 'addresses'} the claim regarding ${claim.text.substring(0, 40)}...`,
          supports: normalizedEvHash > 0.3, // 70% chance of supporting
          confidence: 0.5 + (normalizedEvHash * 0.5),
        });
      }
    }

    return evidence;
  }
}
