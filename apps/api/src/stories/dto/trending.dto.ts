import { z } from 'zod';

export const TrendingSortValues = ['hot', 'most_verified', 'most_contested', 'newest'] as const;
export type TrendingSort = typeof TrendingSortValues[number];

export const TrendingQuerySchema = z.object({
  sort: z.enum(TrendingSortValues).default('hot'),
  category: z.string().optional(),
  label: z.enum(['verified', 'likely', 'contested', 'unverified']).optional(),
  q: z.string().optional(),
  page: z.number().int().min(1).default(1),
  limit: z.number().int().min(1).max(100).default(20),
});

export type TrendingQueryDto = z.infer<typeof TrendingQuerySchema>;

export interface TrendingResponse {
  stories: TrendingStory[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

export interface TrendingStory {
  id: number;
  title: string;
  summary: string | null;
  label: 'verified' | 'likely' | 'contested' | 'unverified';
  confidence: number;
  thumbnailUrl: string | null;
  hotScore: number;
  verificationScore: number;
  controversyScore: number;
  sourcesCount: number;
  evidenceCount: number;
  contradictionsCount: number;
  claimsCount: number;
  seenOn: string[] | null;
  firstSeenAt: Date;
  updatedAt: Date;
}

export interface CategoryDto {
  id: number;
  slug: string;
  name: string;
  description: string | null;
  storyCount: number;
}

export interface StoryDetailDto {
  id: number;
  title: string;
  summary: string | null;
  label: 'verified' | 'likely' | 'contested' | 'unverified';
  confidence: number;
  thumbnailUrl: string | null;
  hotScore: number;
  verificationScore: number;
  controversyScore: number;
  sourcesCount: number;
  evidenceCount: number;
  contradictionsCount: number;
  claimsCount: number;
  seenOn: string[] | null;
  firstSeenAt: Date;
  updatedAt: Date;
  createdAt: Date;
}

export interface ClaimDto {
  id: number;
  text: string;
  type: 'fact' | 'opinion' | 'prediction' | 'quote';
  status: 'pending' | 'verified' | 'disputed' | 'debunked';
  createdAt: Date;
}

export interface EvidenceDto {
  id: number;
  url: string;
  title: string;
  stance: 'supporting' | 'contradicting' | 'neutral';
  snippet: string | null;
  createdAt: Date;
}

export interface EventDto {
  id: number;
  eventType: string;
  data: Record<string, unknown> | null;
  createdAt: Date;
}

export interface PaginatedResponse<T> {
  data: T[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}
