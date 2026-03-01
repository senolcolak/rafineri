import { Injectable, Logger, Optional } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

export type GradientType = 'linear' | 'radial';

export interface GradientColors {
  /** CSS linear-gradient string for frontend use */
  cssGradient: string;
  /** Array of hex color values */
  colors: string[];
  /** Gradient angle in degrees (for linear gradients) */
  angle: number;
  /** Type of gradient */
  type: GradientType;
  /** CSS for radial gradient (if type is radial) */
  cssRadialGradient?: string;
}

export interface GradientOptions {
  /** Seed string to generate deterministic gradient */
  seed: string;
  /** Force specific gradient type */
  type?: GradientType;
  /** Number of colors (2-4, default: auto-determine based on seed) */
  colorCount?: 2 | 3 | 4;
  /** Custom saturation override (0-100) */
  saturation?: number;
  /** Custom lightness override (0-100) */
  lightness?: number;
}

interface HSLColor {
  h: number; // 0-360
  s: number; // 0-100
  l: number; // 0-100
}

interface CacheEntry {
  data: GradientColors;
  expiresAt: number;
}

@Injectable()
export class GradientPlaceholderService {
  private readonly logger = new Logger(GradientPlaceholderService.name);
  private readonly memoryCache = new Map<string, CacheEntry>();
  private readonly defaultCacheTtl: number;
  private readonly useMemoryCache: boolean;

  constructor(
    private readonly configService: ConfigService,
    @Optional() private readonly redisClient?: any,
  ) {
    this.defaultCacheTtl = this.configService.get<number>('gradient.cacheTtl') || 86400; // 24 hours
    this.useMemoryCache = this.configService.get<boolean>('gradient.useMemoryCache') ?? true;
  }

  /**
   * Generate a deterministic gradient based on a seed string
   */
  async generateGradient(options: GradientOptions): Promise<GradientColors> {
    const cacheKey = this.buildCacheKey(options);
    
    // Try cache first
    const cached = await this.getFromCache(cacheKey);
    if (cached) {
      this.logger.debug(`Cache hit for gradient: ${options.seed}`);
      return cached;
    }

    // Generate new gradient
    const gradient = this.createGradient(options);
    
    // Store in cache
    await this.setCache(cacheKey, gradient);
    
    return gradient;
  }

  /**
   * Generate gradient synchronously (without caching)
   */
  generateGradientSync(options: GradientOptions): GradientColors {
    return this.createGradient(options);
  }

  /**
   * Clear the memory cache
   */
  clearMemoryCache(): void {
    this.memoryCache.clear();
    this.logger.log('Memory cache cleared');
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { memorySize: number; ttl: number } {
    // Clean expired entries first
    const now = Date.now();
    for (const [key, entry] of this.memoryCache.entries()) {
      if (entry.expiresAt < now) {
        this.memoryCache.delete(key);
      }
    }
    
    return {
      memorySize: this.memoryCache.size,
      ttl: this.defaultCacheTtl,
    };
  }

  private createGradient(options: GradientOptions): GradientColors {
    const hash = this.hashSeed(options.seed);
    const hashValues = this.extractHashValues(hash);

    // Determine gradient type
    const type = options.type || (hashValues[0] % 2 === 0 ? 'linear' : 'radial');
    
    // Determine number of colors (2-4)
    const colorCount = options.colorCount || (2 + (hashValues[1] % 3));
    
    // Generate colors
    const colors: HSLColor[] = [];
    const baseHue = hashValues[2] % 360;
    
    for (let i = 0; i < colorCount; i++) {
      const hueOffset = (i * 30 + hashValues[3 + i]) % 120; // Spread colors harmoniously
      const hue = (baseHue + hueOffset) % 360;
      
      // Use provided saturation/lightness or generate from hash
      const saturation = options.saturation ?? (50 + (hashValues[4 + i] % 30)); // 50-80%
      const lightness = options.lightness ?? (45 + (hashValues[5 + i] % 25));   // 45-70%
      
      colors.push({ h: hue, s: saturation, l: lightness });
    }

    // Ensure good contrast by adjusting lightness
    this.adjustContrast(colors);

    // Convert to hex
    const hexColors = colors.map(c => this.hslToHex(c));

    // Generate angle for linear gradients
    const angle = hashValues[6] % 360;

    // Build CSS gradients
    const cssGradient = this.buildLinearGradient(colors, angle);
    const cssRadialGradient = type === 'radial' 
      ? this.buildRadialGradient(colors)
      : undefined;

    return {
      cssGradient: type === 'linear' ? cssGradient : cssRadialGradient!,
      colors: hexColors,
      angle,
      type,
      ...(type === 'radial' && { cssRadialGradient }),
    };
  }

  private hashSeed(seed: string): string {
    return crypto.createHash('sha256').update(seed).digest('hex');
  }

  private extractHashValues(hash: string): number[] {
    // Extract 2-character chunks and convert to numbers
    const values: number[] = [];
    for (let i = 0; i < hash.length; i += 2) {
      values.push(parseInt(hash.slice(i, i + 2), 16));
    }
    return values;
  }

  private adjustContrast(colors: HSLColor[]): void {
    if (colors.length < 2) return;

    // Sort by lightness
    const sorted = [...colors].sort((a, b) => a.l - b.l);
    const lightest = sorted[sorted.length - 1];
    const darkest = sorted[0];

    // Ensure minimum contrast of 20% lightness difference
    const minDiff = 20;
    const currentDiff = lightest.l - darkest.l;

    if (currentDiff < minDiff) {
      const adjustment = (minDiff - currentDiff) / 2;
      lightest.l = Math.min(90, lightest.l + adjustment);
      darkest.l = Math.max(10, darkest.l - adjustment);
    }

    // Ensure colors aren't too dark or too light for visibility
    colors.forEach(color => {
      color.l = Math.max(25, Math.min(75, color.l));
    });
  }

  private hslToHex({ h, s, l }: HSLColor): string {
    const sPercent = s / 100;
    const lPercent = l / 100;

    const c = (1 - Math.abs(2 * lPercent - 1)) * sPercent;
    const x = c * (1 - Math.abs((h / 60) % 2 - 1));
    const m = lPercent - c / 2;

    let r = 0, g = 0, b = 0;

    if (h >= 0 && h < 60) {
      r = c; g = x; b = 0;
    } else if (h >= 60 && h < 120) {
      r = x; g = c; b = 0;
    } else if (h >= 120 && h < 180) {
      r = 0; g = c; b = x;
    } else if (h >= 180 && h < 240) {
      r = 0; g = x; b = c;
    } else if (h >= 240 && h < 300) {
      r = x; g = 0; b = c;
    } else {
      r = c; g = 0; b = x;
    }

    const toHex = (n: number): string => {
      const hex = Math.round((n + m) * 255).toString(16);
      return hex.length === 1 ? '0' + hex : hex;
    };

    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  }

  private buildLinearGradient(colors: HSLColor[], angle: number): string {
    const colorStops = colors.map((c, i) => {
      const position = i === 0 ? 0 : i === colors.length - 1 ? 100 : Math.round((i / (colors.length - 1)) * 100);
      return `hsl(${c.h}, ${c.s}%, ${c.l}%) ${position}%`;
    }).join(', ');

    return `linear-gradient(${angle}deg, ${colorStops})`;
  }

  private buildRadialGradient(colors: HSLColor[]): string {
    const colorStops = colors.map((c, i) => {
      const position = i === 0 ? 0 : i === colors.length - 1 ? 100 : Math.round((i / (colors.length - 1)) * 100);
      return `hsl(${c.h}, ${c.s}%, ${c.l}%) ${position}%`;
    }).join(', ');

    return `radial-gradient(circle at center, ${colorStops})`;
  }

  private buildCacheKey(options: GradientOptions): string {
    const parts = [`gradient:${options.seed}`];
    if (options.type) parts.push(`type:${options.type}`);
    if (options.colorCount) parts.push(`colors:${options.colorCount}`);
    if (options.saturation !== undefined) parts.push(`sat:${options.saturation}`);
    if (options.lightness !== undefined) parts.push(`light:${options.lightness}`);
    return parts.join(':');
  }

  private async getFromCache(key: string): Promise<GradientColors | null> {
    // Try Redis first if available
    if (this.redisClient) {
      try {
        const cached = await this.redisClient.get(key);
        if (cached) {
          return JSON.parse(cached) as GradientColors;
        }
      } catch (error) {
        this.logger.warn(`Redis cache error: ${error.message}`);
      }
    }

    // Fall back to memory cache
    if (this.useMemoryCache) {
      const entry = this.memoryCache.get(key);
      if (entry && entry.expiresAt > Date.now()) {
        return entry.data;
      }
      // Clean up expired entry
      if (entry) {
        this.memoryCache.delete(key);
      }
    }

    return null;
  }

  private async setCache(key: string, data: GradientColors): Promise<void> {
    // Try Redis first if available
    if (this.redisClient) {
      try {
        await this.redisClient.setex(key, this.defaultCacheTtl, JSON.stringify(data));
        return;
      } catch (error) {
        this.logger.warn(`Redis cache error: ${error.message}`);
      }
    }

    // Fall back to memory cache
    if (this.useMemoryCache) {
      this.memoryCache.set(key, {
        data,
        expiresAt: Date.now() + this.defaultCacheTtl * 1000,
      });

      // Clean up old entries if cache gets too large
      if (this.memoryCache.size > 10000) {
        const now = Date.now();
        for (const [k, entry] of this.memoryCache.entries()) {
          if (entry.expiresAt < now) {
            this.memoryCache.delete(k);
          }
        }
      }
    }
  }
}
