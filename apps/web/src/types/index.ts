import type { Label } from '@rafineri/shared';

export interface Story {
  id: string;
  title: string;
  summary?: string;
  url?: string;
  imageUrl?: string;
  label: Label;
  score: number;
  category: string;
  evidenceCount: number;
  contradictionsCount: number;
  seenOn: Array<'hn' | 'reddit' | 'manual'>;
  publishedAt: string;
  createdAt: string;
  updatedAt: string;
}

export interface Claim {
  id: string;
  text: string;
  status: 'verified' | 'disputed' | 'debunked' | 'unverified';
  confidence: number;
}

export interface Evidence {
  id: string;
  url: string;
  title: string;
  stance: 'supporting' | 'against' | 'neutral';
  source: string;
  credibility: number;
}

export interface PaginatedStories {
  stories: Story[];
  page: number;
  limit: number;
  total: number;
  totalPages: number;
}

export interface StoryFilters {
  labels?: Label[];
  sources?: string[];
  category?: string;
  searchQuery?: string;
}
