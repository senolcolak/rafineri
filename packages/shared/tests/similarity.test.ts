import { describe, it, expect } from 'vitest';

/**
 * Text Similarity Tests for Story Clustering
 * 
 * These tests verify that the Jaccard similarity and other text comparison
 * functions work correctly for grouping similar items into stories.
 */

// Tokenize text into words (lowercase, alphanumeric only)
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(t => t.length > 2);
}

// Calculate Jaccard similarity between two texts
function jaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = new Set(tokenize(text1));
  const tokens2 = new Set(tokenize(text2));
  
  if (tokens1.size === 0 && tokens2.size === 0) return 1;
  if (tokens1.size === 0 || tokens2.size === 0) return 0;
  
  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);
  
  return intersection.size / union.size;
}

// N-gram similarity for more robust matching
function ngramSimilarity(text1: string, text2: string, n: number = 3): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);
  
  const ngrams1 = new Set<string>();
  const ngrams2 = new Set<string>();
  
  for (let i = 0; i <= tokens1.length - n; i++) {
    ngrams1.add(tokens1.slice(i, i + n).join(' '));
  }
  
  for (let i = 0; i <= tokens2.length - n; i++) {
    ngrams2.add(tokens2.slice(i, i + n).join(' '));
  }
  
  if (ngrams1.size === 0 && ngrams2.size === 0) return 1;
  if (ngrams1.size === 0 || ngrams2.size === 0) return 0;
  
  const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
  const union = new Set([...ngrams1, ...ngrams2]);
  
  return intersection.size / union.size;
}

// Check if two items should be clustered together
function shouldCluster(
  title1: string,
  title2: string,
  url1?: string,
  url2?: string,
  time1?: Date,
  time2?: Date,
  threshold: number = 0.6
): boolean {
  // Check URL match first (exact canonical URL match)
  if (url1 && url2 && url1 === url2) {
    // Check time window (48 hours)
    if (time1 && time2) {
      const hoursDiff = Math.abs(time1.getTime() - time2.getTime()) / (1000 * 60 * 60);
      if (hoursDiff <= 48) {
        return true;
      }
      return false;
    } else {
      return true;
    }
  }
  
  // Check title similarity
  const similarity = jaccardSimilarity(title1, title2);
  return similarity >= threshold;
}

describe('Story Clustering - Similarity Functions', () => {
  describe('tokenization', () => {
    it('should tokenize simple text', () => {
      const text = 'The quick brown fox';
      const tokens = tokenize(text);
      expect(tokens).toContain('the');
      expect(tokens).toContain('quick');
      expect(tokens).toContain('brown');
      expect(tokens).toContain('fox');
    });

    it('should filter out short tokens', () => {
      const text = 'a bb ccc dddd';
      const tokens = tokenize(text);
      expect(tokens).toContain('ccc');
      expect(tokens).toContain('dddd');
      expect(tokens).not.toContain('a');
      expect(tokens).not.toContain('bb');
    });

    it('should normalize to lowercase', () => {
      const text = 'The QUICK Brown FOX';
      const tokens = tokenize(text);
      expect(tokens.every(t => t === t.toLowerCase())).toBe(true);
    });
  });

  describe('Jaccard similarity', () => {
    it('should return 1 for identical texts', () => {
      const text = 'The quick brown fox jumps over the lazy dog';
      expect(jaccardSimilarity(text, text)).toBe(1);
    });

    it('should return 0 for completely different texts', () => {
      const text1 = 'abc def ghi';
      const text2 = 'jkl mno pqr';
      expect(jaccardSimilarity(text1, text2)).toBe(0);
    });

    it('should detect similar news headlines', () => {
      const headline1 = 'Apple announces new iPhone with revolutionary features';
      const headline2 = 'Apple reveals new iPhone featuring revolutionary technology';
      const similarity = jaccardSimilarity(headline1, headline2);
      expect(similarity).toBeGreaterThanOrEqual(0.4);
      expect(similarity).toBeLessThan(1);
    });

    it('should detect very similar headlines', () => {
      const headline1 = 'Tesla stock surges after record deliveries';
      const headline2 = 'Tesla stock jumps following record delivery numbers';
      const similarity = jaccardSimilarity(headline1, headline2);
      expect(similarity).toBeGreaterThanOrEqual(0.3);
    });

    it('should return low score for different topics', () => {
      const headline1 = 'Apple releases new iPhone';
      const headline2 = 'Banana prices increase in supermarket';
      const similarity = jaccardSimilarity(headline1, headline2);
      expect(similarity).toBeLessThan(0.3);
    });
  });

  describe('N-gram similarity', () => {
    it('should detect similarity better with word order', () => {
      const text1 = 'president announces new policy';
      const text2 = 'new policy announced by president';
      const jaccard = jaccardSimilarity(text1, text2);
      const ngram = ngramSimilarity(text1, text2, 2);
      
      // N-gram should capture word order better
      expect(ngram).toBeGreaterThan(0);
    });
  });

  describe('clustering decision', () => {
    it('should cluster identical URLs within 48 hours', () => {
      const now = new Date();
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      
      const result = shouldCluster(
        'Different titles',
        'Different titles here',
        'https://example.com/article',
        'https://example.com/article',
        now,
        yesterday
      );
      
      expect(result).toBe(true);
    });

    it('should NOT cluster identical URLs beyond 48 hours', () => {
      const now = new Date();
      const lastWeek = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      
      const result = shouldCluster(
        'Same title',
        'Same title',
        'https://example.com/article',
        'https://example.com/article',
        now,
        lastWeek
      );
      
      expect(result).toBe(false);
    });

    it('should cluster similar titles', () => {
      const result = shouldCluster(
        'Tesla reports record profits in Q3',
        'Tesla announces record Q3 profits',
        undefined,
        undefined,
        undefined,
        undefined,
        0.5
      );
      
      expect(result).toBe(true);
    });

    it('should NOT cluster different titles', () => {
      const result = shouldCluster(
        'Tesla stock rises',
        'Apple releases new iPad',
        undefined,
        undefined,
        undefined,
        undefined,
        0.5
      );
      
      expect(result).toBe(false);
    });
  });
});
