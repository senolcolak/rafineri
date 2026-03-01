import type { Label } from '@rafineri/shared';

// Re-export types from @rafineri/shared
export type { Story, PaginatedStories, Claim, Evidence } from '@rafineri/shared';

export interface StoryFilters {
  labels?: Label[];
  sources?: string[];
  category?: string;
  searchQuery?: string;
}
