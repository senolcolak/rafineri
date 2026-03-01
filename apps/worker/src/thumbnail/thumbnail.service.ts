import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { createHash } from 'crypto';

export interface ThumbnailResult {
  thumbnailUrl: string | null;
  isPlaceholder: boolean;
  thumbnailSource: 'og_image' | 'twitter_image' | 'favicon' | 'placeholder';
  placeholderGradient?: {
    angle: number;
    colors: string[];
    css: string;
  };
}

interface FaviconResult {
  faviconUrl: string | null;
  html: string;
}

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);
  private readonly redis: Redis;

  // Gradient color palettes for placeholder generation
  private readonly gradientPalettes = [
    { from: '#667eea', to: '#764ba2' },
    { from: '#f093fb', to: '#f5576c' },
    { from: '#4facfe', to: '#00f2fe' },
    { from: '#43e97b', to: '#38f9d7' },
    { from: '#fa709a', to: '#fee140' },
    { from: '#30cfd0', to: '#330867' },
    { from: '#a8edea', to: '#fed6e3' },
    { from: '#ff9a9e', to: '#fecfef' },
    { from: '#ffecd2', to: '#fcb69f' },
    { from: '#ff8a80', to: '#ea6100' },
    { from: '#84fab0', to: '#8fd3f4' },
    { from: '#a1c4fd', to: '#c2e9fb' },
  ];

  constructor(private readonly configService: ConfigService) {
    // Initialize Redis connection
    this.redis = new Redis({
      host: this.configService.get('redis.host'),
      port: this.configService.get('redis.port'),
      password: this.configService.get('redis.password'),
      db: this.configService.get('redis.db'),
      retryStrategy: (times) => Math.min(times * 50, 2000),
      maxRetriesPerRequest: 3,
    });
  }

  /**
   * Extract thumbnail from URL with fallback chain:
   * 1. og:image (Open Graph)
   * 2. twitter:image (Twitter Card)
   * 3. favicon + gradient placeholder
   * 
   * Features:
   * - HTML caching in Redis (24 hours)
   * - Domain throttling (1 request per 5 seconds)
   * - 5s timeout for fetch
   * - Basic robots.txt respect
   */
  async extractThumbnail(
    storyId: string,
    url: string,
    title?: string
  ): Promise<ThumbnailResult> {
    this.logger.log(`Extracting thumbnail for story ${storyId} from ${url}`);

    try {
      const result = await this.fetchThumbnail(storyId, url, title);
      
      this.logger.log(
        `Thumbnail extracted for story ${storyId}: ${result.thumbnailSource}`
      );
      
      return result;
    } catch (error) {
      this.logger.error(`Failed to extract thumbnail for ${url}:`, error);
      
      // Return gradient placeholder on failure
      const gradient = this.generateGradient(title || storyId);
      return {
        thumbnailUrl: null,
        isPlaceholder: true,
        thumbnailSource: 'placeholder',
        placeholderGradient: gradient,
      };
    }
  }

  private async fetchThumbnail(
    storyId: string,
    url: string,
    title?: string
  ): Promise<ThumbnailResult> {
    const parsedUrl = new URL(url);
    const domain = parsedUrl.hostname;

    // Check domain throttling
    const canProceed = await this.checkDomainThrottle(domain);
    if (!canProceed) {
      this.logger.warn(`Domain ${domain} is rate limited, using cached or placeholder`);
      // Try to use cached HTML if available
      const cachedHtml = await this.getCachedHtml(domain, parsedUrl.pathname);
      if (cachedHtml) {
        return this.parseThumbnailFromHtml(cachedHtml, url, title || storyId);
      }
      // Return placeholder if throttled and no cache
      const gradient = this.generateGradient(title || storyId);
      return {
        thumbnailUrl: null,
        isPlaceholder: true,
        thumbnailSource: 'placeholder',
        placeholderGradient: gradient,
      };
    }

    // Check robots.txt before fetching
    const isAllowed = await this.checkRobotsTxt(domain, parsedUrl.pathname);
    if (!isAllowed) {
      this.logger.warn(`URL ${url} is disallowed by robots.txt`);
      const gradient = this.generateGradient(title || storyId);
      return {
        thumbnailUrl: null,
        isPlaceholder: true,
        thumbnailSource: 'placeholder',
        placeholderGradient: gradient,
      };
    }

    // Check HTML cache first
    const cachedHtml = await this.getCachedHtml(domain, parsedUrl.pathname);
    if (cachedHtml) {
      this.logger.debug(`Using cached HTML for ${url}`);
      return this.parseThumbnailFromHtml(cachedHtml, url, title || storyId);
    }

    // Fetch with timeout
    const timeout = this.configService.get('app.thumbnail.timeout') || 5000;
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'RafineriBot/1.0 (Thumbnail Extraction; +https://rafineri.org/bot)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'Accept-Language': 'en-US,en;q=0.5',
          'Accept-Encoding': 'gzip, deflate, br',
          'DNT': '1',
          'Connection': 'keep-alive',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const html = await response.text();
      const baseUrl = response.url || url;

      // Cache the HTML for 24 hours
      await this.cacheHtml(domain, parsedUrl.pathname, html);

      // Update domain throttle timestamp
      await this.updateDomainThrottle(domain);

      return this.parseThumbnailFromHtml(html, baseUrl, title || storyId);

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  /**
   * Parse thumbnail from HTML using fallback chain:
   * 1. og:image
   * 2. twitter:image
   * 3. favicon + gradient placeholder
   */
  private parseThumbnailFromHtml(
    html: string,
    baseUrl: string,
    seed: string
  ): ThumbnailResult {
    // Try Open Graph image first
    const ogImage = this.extractMetaTag(html, 'og:image');
    if (ogImage) {
      return {
        thumbnailUrl: this.resolveUrl(ogImage, baseUrl),
        isPlaceholder: false,
        thumbnailSource: 'og_image',
      };
    }

    // Try Twitter card image
    const twitterImage = this.extractMetaTag(html, 'twitter:image') || 
                         this.extractMetaTag(html, 'twitter:image:src');
    if (twitterImage) {
      return {
        thumbnailUrl: this.resolveUrl(twitterImage, baseUrl),
        isPlaceholder: false,
        thumbnailSource: 'twitter_image',
      };
    }

    // Fallback: favicon + gradient placeholder
    const faviconResult = this.extractFavicon(html, baseUrl);
    const gradient = this.generateGradient(seed);
    
    return {
      thumbnailUrl: faviconResult.faviconUrl,
      isPlaceholder: true,
      thumbnailSource: faviconResult.faviconUrl ? 'favicon' : 'placeholder',
      placeholderGradient: gradient,
    };
  }

  /**
   * Extract favicon URL from HTML
   */
  private extractFavicon(html: string, baseUrl: string): FaviconResult {
    // Try various favicon link types
    const faviconPatterns = [
      /<link[^>]+rel=["']apple-touch-icon["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+rel=["']apple-touch-icon-precomposed["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+rel=["']icon["'][^>]+type=["']image\/png["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+rel=["']icon["'][^>]+href=["']([^"']+)["']/i,
      /<link[^>]+rel=["']shortcut icon["'][^>]+href=["']([^"']+)["']/i,
    ];

    for (const pattern of faviconPatterns) {
      const match = html.match(pattern);
      if (match) {
        return {
          faviconUrl: this.resolveUrl(this.cleanImageUrl(match[1]), baseUrl),
          html,
        };
      }
    }

    // Default to /favicon.ico
    const base = new URL(baseUrl);
    return {
      faviconUrl: `${base.protocol}//${base.host}/favicon.ico`,
      html,
    };
  }

  /**
   * Generate a deterministic gradient based on seed string
   */
  private generateGradient(seed: string): { angle: number; colors: string[]; css: string } {
    const hash = createHash('md5').update(seed).digest('hex');
    const index = parseInt(hash.slice(0, 8), 16) % this.gradientPalettes.length;
    const palette = this.gradientPalettes[index];
    const angle = parseInt(hash.slice(8, 12), 16) % 360;
    
    return {
      angle,
      colors: [palette.from, palette.to],
      css: `linear-gradient(${angle}deg, ${palette.from}, ${palette.to})`,
    };
  }

  /**
   * Check and enforce domain throttling (1 request per 5 seconds)
   */
  private async checkDomainThrottle(domain: string): Promise<boolean> {
    const key = `throttle:domain:${domain}`;
    const lastRequest = await this.redis.get(key);
    
    if (!lastRequest) {
      return true;
    }

    const lastTime = parseInt(lastRequest, 10);
    const now = Date.now();
    const throttleMs = 5000; // 5 seconds

    return now - lastTime >= throttleMs;
  }

  /**
   * Update domain throttle timestamp
   */
  private async updateDomainThrottle(domain: string): Promise<void> {
    const key = `throttle:domain:${domain}`;
    await this.redis.set(key, Date.now().toString(), 'EX', 60); // Expire after 60 seconds
  }

  /**
   * Get cached HTML content from Redis
   */
  private async getCachedHtml(domain: string, pathname: string): Promise<string | null> {
    const pathnameHash = createHash('md5').update(pathname).digest('hex');
    const key = `html:cache:${domain}:${pathnameHash}`;
    return this.redis.get(key);
  }

  /**
   * Cache HTML content in Redis for 24 hours
   */
  private async cacheHtml(domain: string, pathname: string, html: string): Promise<void> {
    const pathnameHash = createHash('md5').update(pathname).digest('hex');
    const key = `html:cache:${domain}:${pathnameHash}`;
    const ttlSeconds = 24 * 60 * 60; // 24 hours
    
    // Limit cache size to 1MB per page
    const maxSize = 1024 * 1024;
    const content = html.length > maxSize ? html.slice(0, maxSize) : html;
    
    await this.redis.set(key, content, 'EX', ttlSeconds);
  }

  /**
   * Basic robots.txt check
   * Only checks cached robots.txt, doesn't fetch if not cached
   */
  private async checkRobotsTxt(domain: string, pathname: string): Promise<boolean> {
    const cacheKey = `robots:cache:${domain}`;
    const cachedRobots = await this.redis.get(cacheKey);
    
    if (cachedRobots === null) {
      // No cached robots.txt, fetch and cache it
      try {
        const robotsUrl = `https://${domain}/robots.txt`;
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 3000);
        
        const response = await fetch(robotsUrl, {
          signal: controller.signal,
          headers: {
            'User-Agent': 'RafineriBot/1.0',
          },
        });
        
        clearTimeout(timeoutId);
        
        if (response.ok) {
          const robotsTxt = await response.text();
          // Cache robots.txt for 1 hour
          await this.redis.set(cacheKey, robotsTxt, 'EX', 3600);
          return this.isPathAllowed(robotsTxt, pathname);
        } else {
          // No robots.txt or error - assume allowed
          await this.redis.set(cacheKey, '', 'EX', 3600);
          return true;
        }
      } catch (error) {
        // Error fetching robots.txt - assume allowed
        await this.redis.set(cacheKey, '', 'EX', 3600);
        return true;
      }
    }

    if (cachedRobots === '') {
      // Empty robots.txt means all allowed
      return true;
    }

    return this.isPathAllowed(cachedRobots, pathname);
  }

  /**
   * Parse robots.txt and check if path is allowed
   * Basic implementation - checks for Disallow rules
   */
  private isPathAllowed(robotsTxt: string, pathname: string): boolean {
    const lines = robotsTxt.split('\n');
    let isRelevantSection = false;
    let isAllowed = true;

    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip comments and empty lines
      if (trimmed.startsWith('#') || trimmed === '') {
        continue;
      }

      // Check for user-agent
      if (trimmed.toLowerCase().startsWith('user-agent:')) {
        const userAgent = trimmed.slice(11).trim().toLowerCase();
        // Check if this section applies to us (wildcard or contains 'bot' or our name)
        isRelevantSection = userAgent === '*' || 
                            userAgent.includes('bot') || 
                            userAgent.includes('rafineri');
        continue;
      }

      if (!isRelevantSection) {
        continue;
      }

      // Check disallow
      if (trimmed.toLowerCase().startsWith('disallow:')) {
        const disallowedPath = trimmed.slice(9).trim();
        if (disallowedPath === '') {
          // Empty disallow means allow all
          isAllowed = true;
        } else if (pathname.startsWith(disallowedPath)) {
          isAllowed = false;
        }
      }

      // Check allow (overrides disallow)
      if (trimmed.toLowerCase().startsWith('allow:')) {
        const allowedPath = trimmed.slice(6).trim();
        if (pathname.startsWith(allowedPath)) {
          isAllowed = true;
        }
      }
    }

    return isAllowed;
  }

  private extractMetaTag(html: string, property: string): string | null {
    // Match both property="..." and name="..." attributes
    const patterns = [
      new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["']`, 'i'),
      new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["']`, 'i'),
      new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["']`, 'i'),
    ];

    for (const pattern of patterns) {
      const match = html.match(pattern);
      if (match) {
        return this.cleanImageUrl(match[1]);
      }
    }

    return null;
  }

  private cleanImageUrl(url: string): string {
    // Remove HTML entities
    return url
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .trim();
  }

  private resolveUrl(url: string, baseUrl: string): string {
    // Already absolute
    if (url.match(/^https?:\/\//i)) {
      return url;
    }

    // Protocol-relative
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    // Root-relative
    if (url.startsWith('/')) {
      const base = new URL(baseUrl);
      return `${base.protocol}//${base.host}${url}`;
    }

    // Path-relative
    const base = new URL(baseUrl);
    const path = base.pathname.split('/').slice(0, -1).join('/');
    return `${base.protocol}//${base.host}${path}/${url}`;
  }
}
