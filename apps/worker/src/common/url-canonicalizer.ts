import { Logger } from '@nestjs/common';

/**
 * URL Canonicalization Utility
 * 
 * Strips tracking parameters and normalizes URLs for comparison.
 */

const logger = new Logger('UrlCanonicalizer');

/**
 * Tracking parameters to remove from URLs
 */
const TRACKING_PARAMS = new Set([
  // Google Analytics
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'utm_id',
  'utm_source_platform',
  'utm_creative_format',
  'utm_marketing_tactic',
  
  // Google Ads
  'gclid',
  'gclsrc',
  'dclid',
  'gad',
  'gad_source',
  
  // Facebook
  'fbclid',
  'fb_action_ids',
  'fb_action_types',
  'fb_ref',
  'fb_source',
  'fbadid',
  
  // Microsoft/Bing
  'msclkid',
  
  // Twitter/X
  'twclid',
  
  // TikTok
  'ttclid',
  
  // LinkedIn
  'li_fat_id',
  
  // Pinterest
  'epik',
  'pp',
  
  // Wicked Reports
  'wickedid',
  
  // Yahoo
  'yclid',
  
  // Mailchimp
  'mc_cid',
  'mc_eid',
  
  // HubSpot
  'hsa_cam',
  'hsa_grp',
  'hsa_mt',
  'hsa_src',
  'hsa_ad',
  'hsa_acc',
  'hsa_net',
  'hsa_kw',
  'hsa_tgt',
  'hsa_la',
  'hsa_ol',
  'hsa_ver',
  
  // Generic
  'ref',
  'referrer',
  'referral',
  'source',
  'medium',
  'campaign',
  'term',
  'content',
  'cid',
  'sid',
  'rid',
  'mid',
  'pid',
  'vid',
  'uuid',
  'trace',
  'trk',
  'track',
  'tracking',
  'click',
  'clickid',
  
  // Reddit
  'rdt_cid',
  
  // Snapchat
  'sc_cid',
  
  // Affiliate
  'affiliate',
  'aff',
  'aff_id',
  'affiliate_id',
  'partner',
  'partner_id',
  
  // Google AMP
  'amp',
  'amp_js_v',
  'usqp',
  
  // YouTube
  'feature',
  'ab_channel',
  
  // Other
  '_ga',
  '_gid',
  '_gac',
  '_gl',
  '__hsfp',
  '__hssc',
  '__hstc',
  '__hs_c2',
  '__hs_preview',
  '_hsenc',
  '_hsmi',
  'hsCtaTracking',
]);

/**
 * Canonicalize a URL by:
 * 1. Converting to lowercase
 * 2. Removing tracking parameters
 * 3. Removing empty query strings
 * 4. Normalizing the path
 * 5. Removing fragment unless meaningful
 */
export function canonicalizeUrl(url: string): string {
  try {
    const urlObj = new URL(url);
    
    // Convert hostname to lowercase
    urlObj.hostname = urlObj.hostname.toLowerCase();
    
    // Remove tracking parameters
    for (const param of TRACKING_PARAMS) {
      urlObj.searchParams.delete(param);
    }
    
    // Remove empty search params
    if (urlObj.searchParams.toString() === '') {
      urlObj.search = '';
    }
    
    // Normalize path
    // Remove trailing slash (except for root)
    if (urlObj.pathname.length > 1 && urlObj.pathname.endsWith('/')) {
      urlObj.pathname = urlObj.pathname.slice(0, -1);
    }
    
    // Remove index files from path
    const indexFiles = ['/index.html', '/index.htm', '/index.php', '/default.html', '/home.html'];
    for (const indexFile of indexFiles) {
      if (urlObj.pathname.endsWith(indexFile)) {
        urlObj.pathname = urlObj.pathname.slice(0, -indexFile.length) || '/';
        break;
      }
    }
    
    // Remove fragment unless it's likely meaningful
    const meaningfulFragmentPatterns = [
      /^section-\d+$/i,
      /^article-\d+$/i,
      /^comment-\d+$/i,
      /^post-\d+$/i,
      /^[a-z]+-\d+$/i, // e.g., "chapter-5", "page-3"
    ];
    
    const hasMeaningfulFragment = meaningfulFragmentPatterns.some(pattern => 
      pattern.test(urlObj.hash.slice(1))
    );
    
    if (!hasMeaningfulFragment) {
      urlObj.hash = '';
    }
    
    return urlObj.toString();
  } catch (error) {
    logger.warn(`Failed to canonicalize URL: ${url}`, error);
    return url.toLowerCase().trim();
  }
}

/**
 * Normalize a URL for comparison (more aggressive than canonicalization)
 * This is used for exact matching
 */
export function normalizeUrl(url: string): string {
  try {
    const canonical = canonicalizeUrl(url);
    const urlObj = new URL(canonical);
    
    // Remove www prefix
    let hostname = urlObj.hostname;
    if (hostname.startsWith('www.')) {
      hostname = hostname.slice(4);
    }
    
    // Remove protocol
    return hostname + urlObj.pathname + urlObj.search;
  } catch {
    return url.toLowerCase();
  }
}

/**
 * Check if two URLs are equivalent after canonicalization
 */
export function urlsEqual(url1: string, url2: string): boolean {
  return normalizeUrl(url1) === normalizeUrl(url2);
}

/**
 * Extract the domain from a URL
 */
export function extractDomain(url: string): string | null {
  try {
    const urlObj = new URL(url);
    return urlObj.hostname.replace(/^www\./, '').toLowerCase();
  } catch {
    return null;
  }
}

/**
 * Check if a URL is from a known social media or aggregator site
 * These URLs often need special handling
 */
export function isSocialMediaUrl(url: string): boolean {
  const socialDomains = [
    'twitter.com',
    'x.com',
    'facebook.com',
    'fb.com',
    'instagram.com',
    'linkedin.com',
    'reddit.com',
    'redd.it',
    'news.ycombinator.com',
    'youtube.com',
    'youtu.be',
    'tiktok.com',
    't.co',
  ];
  
  const domain = extractDomain(url);
  if (!domain) return false;
  
  return socialDomains.some(social => domain === social || domain.endsWith(`.${social}`));
}

/**
 * Extract the "real" URL from a redirect/shortener URL
 * Handles common shorteners and redirect services
 */
export function extractRealUrl(url: string): string | null {
  try {
    const urlObj = new URL(url);
    
    // t.co (Twitter)
    if (urlObj.hostname === 't.co') {
      // Would need to follow the redirect to get real URL
      return null;
    }
    
    // YouTube short links
    if (urlObj.hostname === 'youtu.be') {
      const videoId = urlObj.pathname.slice(1);
      return `https://youtube.com/watch?v=${videoId}`;
    }
    
    // Reddit short links
    if (urlObj.hostname === 'redd.it') {
      // Would need to follow the redirect
      return null;
    }
    
    return url;
  } catch {
    return null;
  }
}
