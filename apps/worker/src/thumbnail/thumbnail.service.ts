import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

interface ThumbnailResult {
  storyId: string;
  thumbnailUrl: string;
  source: 'og:image' | 'twitter:image' | 'first_image' | 'placeholder';
}

@Injectable()
export class ThumbnailService {
  private readonly logger = new Logger(ThumbnailService.name);

  constructor(private readonly configService: ConfigService) {}

  async extractThumbnail(storyId: string, url: string): Promise<string> {
    this.logger.log(`Extracting thumbnail for story ${storyId} from ${url}`);

    try {
      const result = await this.fetchThumbnail(url);
      
      // Persist to database
      await this.persistThumbnail(storyId, result.thumbnailUrl, result.source);

      this.logger.log(`Thumbnail extracted for story ${storyId}: ${result.source}`);
      
      return result.thumbnailUrl;
    } catch (error) {
      this.logger.error(`Failed to extract thumbnail for ${url}:`, error);
      
      // Use placeholder on failure
      const placeholderUrl = this.configService.get('app.thumbnail.placeholderUrl');
      await this.persistThumbnail(storyId, placeholderUrl, 'placeholder');
      
      return placeholderUrl;
    }
  }

  private async fetchThumbnail(url: string): Promise<ThumbnailResult> {
    const timeout = this.configService.get('app.thumbnail.timeout');
    const maxRedirects = this.configService.get('app.thumbnail.maxRedirects');

    // Create AbortController for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await fetch(url, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'RafineriBot/1.0 (Thumbnail Extraction)',
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
      const baseUrl = response.url || url; // Use final URL after redirects

      // Parse HTML and extract image
      const thumbnailUrl = this.parseThumbnailUrl(html, baseUrl);

      if (thumbnailUrl) {
        return {
          storyId: '', // Will be set by caller
          thumbnailUrl,
          source: this.detectImageSource(html, thumbnailUrl),
        };
      }

      // No image found, use placeholder
      return {
        storyId: '',
        thumbnailUrl: this.configService.get('app.thumbnail.placeholderUrl'),
        source: 'placeholder',
      };

    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        throw new Error(`Request timeout after ${timeout}ms`);
      }
      
      throw error;
    }
  }

  private parseThumbnailUrl(html: string, baseUrl: string): string | null {
    // Try Open Graph image first (highest priority)
    const ogImage = this.extractMetaTag(html, 'og:image');
    if (ogImage) {
      return this.resolveUrl(ogImage, baseUrl);
    }

    // Try Twitter card image
    const twitterImage = this.extractMetaTag(html, 'twitter:image');
    if (twitterImage) {
      return this.resolveUrl(twitterImage, baseUrl);
    }

    // Try Twitter image src (alternate)
    const twitterImageSrc = this.extractMetaTag(html, 'twitter:image:src');
    if (twitterImageSrc) {
      return this.resolveUrl(twitterImageSrc, baseUrl);
    }

    // Try to find first substantial image in content
    const firstImage = this.extractFirstImage(html, baseUrl);
    if (firstImage) {
      return firstImage;
    }

    return null;
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

  private extractFirstImage(html: string, baseUrl: string): string | null {
    // Skip common non-content images (logos, icons, ads, etc.)
    const skipPatterns = [
      /logo/i,
      /icon/i,
      /avatar/i,
      /ad[s]?\./i,
      /banner/i,
      /header/i,
      /footer/i,
      /social/i,
      /share/i,
      /button/i,
      /spacer/i,
      /pixel/i,
      /tracking/i,
      /1x1/i,
      /clear\.gif/i,
    ];

    // Find all img tags
    const imgRegex = /<img[^>]+src=["']([^"']+)["'][^>]*>/gi;
    let match;

    while ((match = imgRegex.exec(html)) !== null) {
      const src = match[1];
      const fullTag = match[0];

      // Skip data URIs that are too small (likely tracking pixels)
      if (src.startsWith('data:')) {
        // Check if it's a substantial image
        if (src.length < 1000) continue;
      }

      // Skip URLs matching skip patterns
      if (skipPatterns.some(pattern => pattern.test(src))) {
        continue;
      }

      // Check alt text for skip patterns
      const altMatch = fullTag.match(/alt=["']([^"']*)["']/i);
      if (altMatch && skipPatterns.some(pattern => pattern.test(altMatch[1]))) {
        continue;
      }

      // Skip very small images (likely icons)
      const widthMatch = fullTag.match(/width=["']?(\d+)/i);
      const heightMatch = fullTag.match(/height=["']?(\d+)/i);
      
      if (widthMatch && parseInt(widthMatch[1]) < 100) continue;
      if (heightMatch && parseInt(heightMatch[1]) < 50) continue;

      return this.resolveUrl(this.cleanImageUrl(src), baseUrl);
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

    // Protocol-relative URL
    if (url.startsWith('//')) {
      return `https:${url}`;
    }

    try {
      const base = new URL(baseUrl);

      // Root-relative URL
      if (url.startsWith('/')) {
        return `${base.protocol}//${base.host}${url}`;
      }

      // Relative URL
      const basePath = base.pathname.split('/').slice(0, -1).join('/');
      return `${base.protocol}//${base.host}${basePath}/${url}`;
    } catch {
      return url;
    }
  }

  private detectImageSource(html: string, thumbnailUrl: string): ThumbnailResult['source'] {
    // Check if URL was from og:image
    if (this.extractMetaTag(html, 'og:image')?.includes(thumbnailUrl.split('/').pop() || '')) {
      return 'og:image';
    }

    // Check if URL was from twitter:image
    if (this.extractMetaTag(html, 'twitter:image')?.includes(thumbnailUrl.split('/').pop() || '')) {
      return 'twitter:image';
    }

    return 'first_image';
  }

  private async persistThumbnail(
    storyId: string, 
    thumbnailUrl: string, 
    source: string
  ): Promise<void> {
    const query = `
      UPDATE stories
      SET 
        thumbnail_url = $2,
        thumbnail_source = $3,
        thumbnail_updated_at = $4,
        updated_at = $4
      WHERE id = $1
    `;

    try {
      // This would use the actual database client
      this.logger.debug(`Persisting thumbnail for story ${storyId}: ${thumbnailUrl} (source: ${source})`);
      // await this.db.execute(query, [storyId, thumbnailUrl, source, new Date()]);
    } catch (error) {
      this.logger.error(`Failed to persist thumbnail for story ${storyId}:`, error);
    }
  }
}
