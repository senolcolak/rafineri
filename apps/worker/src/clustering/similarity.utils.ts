/**
 * Text similarity utilities for story clustering
 */

/**
 * Tokenize a string into a set of normalized tokens
 * - Lowercases the text
 * - Removes punctuation
 * - Splits on whitespace
 * - Removes common stop words
 */
export function tokenize(text: string): Set<string> {
  const stopWords = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
    'could', 'should', 'may', 'might', 'must', 'can', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they',
    'my', 'your', 'his', 'her', 'its', 'our', 'their', 'what', 'which',
    'who', 'when', 'where', 'why', 'how', 'all', 'any', 'both', 'each',
    'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
    'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'now',
  ]);

  const normalized = text
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')  // Replace punctuation with spaces
    .replace(/\s+/g, ' ')       // Normalize whitespace
    .trim();

  const tokens = normalized
    .split(' ')
    .filter(token => token.length > 2)     // Filter short tokens
    .filter(token => !stopWords.has(token)); // Filter stop words

  return new Set(tokens);
}

/**
 * Calculate Jaccard similarity between two strings
 * Jaccard(A, B) = |A ∩ B| / |A ∪ B|
 * 
 * Returns a value between 0 (completely dissimilar) and 1 (identical)
 */
export function jaccardSimilarity(text1: string, text2: string): number {
  const tokens1 = tokenize(text1);
  const tokens2 = tokenize(text2);

  if (tokens1.size === 0 && tokens2.size === 0) {
    return 1; // Both empty = identical
  }

  if (tokens1.size === 0 || tokens2.size === 0) {
    return 0; // One empty, one not = completely different
  }

  const intersection = new Set([...tokens1].filter(x => tokens2.has(x)));
  const union = new Set([...tokens1, ...tokens2]);

  return intersection.size / union.size;
}

/**
 * Calculate Jaccard similarity between two sets of tokens directly
 */
export function jaccardSimilaritySets(set1: Set<string>, set2: Set<string>): number {
  if (set1.size === 0 && set2.size === 0) {
    return 1;
  }

  if (set1.size === 0 || set2.size === 0) {
    return 0;
  }

  const intersection = new Set([...set1].filter(x => set2.has(x)));
  const union = new Set([...set1, ...set2]);

  return intersection.size / union.size;
}

/**
 * Calculate n-gram similarity for more robust matching
 * Good for catching small word order changes
 */
export function ngramSimilarity(text1: string, text2: string, n: number = 2): number {
  const getNgrams = (text: string): Set<string> => {
    const normalized = text.toLowerCase().replace(/[^\w\s]/g, '');
    const words = normalized.split(/\s+/).filter(w => w.length > 0);
    const ngrams = new Set<string>();
    
    for (let i = 0; i <= words.length - n; i++) {
      ngrams.add(words.slice(i, i + n).join(' '));
    }
    
    return ngrams;
  };

  const ngrams1 = getNgrams(text1);
  const ngrams2 = getNgrams(text2);

  if (ngrams1.size === 0 && ngrams2.size === 0) {
    return 1;
  }

  if (ngrams1.size === 0 || ngrams2.size === 0) {
    return 0;
  }

  const intersection = new Set([...ngrams1].filter(x => ngrams2.has(x)));
  const union = new Set([...ngrams1, ...ngrams2]);

  return intersection.size / union.size;
}

/**
 * Combined similarity that uses both token Jaccard and n-gram similarity
 * Returns the maximum of both for more robust matching
 */
export function combinedSimilarity(text1: string, text2: string): number {
  const jaccard = jaccardSimilarity(text1, text2);
  const ngram = ngramSimilarity(text1, text2, 2);
  
  // Use max to be more permissive (catches more potential matches)
  // Could also use weighted average: 0.7 * jaccard + 0.3 * ngram
  return Math.max(jaccard, ngram);
}

/**
 * Normalize a URL for comparison
 * - Converts to lowercase
 * - Removes protocol
 * - Removes www prefix
 * - Removes trailing slash
 */
export function normalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    let normalized = urlObj.hostname.replace(/^www\./, '') + urlObj.pathname;
    normalized = normalized.toLowerCase();
    if (normalized.endsWith('/')) {
      normalized = normalized.slice(0, -1);
    }
    return normalized;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Check if two URLs are the same (after normalization)
 */
export function urlsMatch(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Pre-tokenize titles for faster batch comparison
 */
export function preTokenizeTitles(titles: string[]): Map<string, Set<string>> {
  const tokenMap = new Map<string, Set<string>>();
  for (const title of titles) {
    tokenMap.set(title, tokenize(title));
  }
  return tokenMap;
}
