import { describe, it, expect } from 'vitest';

/**
 * URL Canonicalization Tests
 * 
 * These tests verify that tracking parameters are properly stripped from URLs
 * to enable accurate deduplication of content.
 */

function canonicalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // List of tracking parameters to remove
    const trackingParams = [
      // Google Analytics
      'utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content',
      'utm_id', 'utm_source_platform', 'utm_creative_format', 'utm_marketing_tactic',
      // Google Ads
      'gclid', 'gclsrc', 'dclid',
      // Facebook
      'fbclid', 'fb_action_ids', 'fb_action_types', 'fb_source',
      // Microsoft
      'msclkid',
      // Other common tracking
      'ref', 'referrer', 'source', 'medium', 'campaign',
      'cid', 'mc_cid', 'mc_eid',
      'yclid', 'twclid', 'li_fat_id',
      'wickedid', 'wt_zmc',
      // Social media
      'si', 'feature', 'context',
    ];
    
    // Remove tracking parameters
    trackingParams.forEach(param => {
      urlObj.searchParams.delete(param);
    });
    
    // Remove hash/fragment (unless it's a special case like #! for old ajax sites)
    urlObj.hash = '';
    
    // Normalize the URL
    let canonical = urlObj.toString();
    
    // Remove trailing ? if no params remain
    canonical = canonical.replace(/\?$/, '');
    
    return canonical;
  } catch {
    return url;
  }
}

describe('URL Canonicalization', () => {
  describe('tracking parameter removal', () => {
    it('should remove UTM parameters', () => {
      const input = 'https://example.com/article?utm_source=newsletter&utm_medium=email&utm_campaign=spring';
      const expected = 'https://example.com/article';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('should remove Google Ads parameters', () => {
      const input = 'https://example.com/product?gclid=abc123&item=1';
      const expected = 'https://example.com/product?item=1';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('should remove Facebook click ID', () => {
      const input = 'https://example.com/post?fbclid=xyz789&id=42';
      const expected = 'https://example.com/post?id=42';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('should remove Microsoft click ID', () => {
      const input = 'https://example.com/page?msclkid=def456&sort=date';
      const expected = 'https://example.com/page?sort=date';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('should remove ref parameters', () => {
      const input = 'https://example.com/news?ref=hackernews&slug=tech';
      const expected = 'https://example.com/news?slug=tech';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('should remove multiple tracking parameters', () => {
      const input = 'https://example.com/article?utm_source=twitter&utm_medium=social&gclid=abc&ref=home';
      const expected = 'https://example.com/article';
      expect(canonicalizeUrl(input)).toBe(expected);
    });
  });

  describe('fragment removal', () => {
    it('should remove URL fragments', () => {
      const input = 'https://example.com/article#section-1';
      const expected = 'https://example.com/article';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('should remove fragment and tracking params', () => {
      const input = 'https://example.com/article?utm_source=email#comments';
      const expected = 'https://example.com/article';
      expect(canonicalizeUrl(input)).toBe(expected);
    });
  });

  describe('preserving important parameters', () => {
    it('should preserve content-related query params', () => {
      const input = 'https://example.com/article?id=123&page=2&utm_source=email';
      const expected = 'https://example.com/article?id=123&page=2';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('should preserve search queries', () => {
      const input = 'https://example.com/search?q=typescript&sort=relevance&utm_campaign=search';
      const expected = 'https://example.com/search?q=typescript&sort=relevance';
      expect(canonicalizeUrl(input)).toBe(expected);
    });
  });

  describe('edge cases', () => {
    it('should handle URLs without query params', () => {
      const input = 'https://example.com/article';
      expect(canonicalizeUrl(input)).toBe(input);
    });

    it('should handle URLs with only tracking params', () => {
      const input = 'https://example.com/article?utm_source=email';
      const expected = 'https://example.com/article';
      expect(canonicalizeUrl(input)).toBe(expected);
    });

    it('should handle malformed URLs gracefully', () => {
      const input = 'not-a-valid-url';
      expect(canonicalizeUrl(input)).toBe(input);
    });
  });
});
