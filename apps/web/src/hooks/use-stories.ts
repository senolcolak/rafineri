import { useQuery, useInfiniteQuery } from '@tanstack/react-query';
import { api } from '@/lib/api';
import type { Story, PaginatedStories, Label } from '@rafineri/shared';
import type { StoryFilters } from '@/types';

interface UseStoriesOptions {
  sortBy?: string;
  filters?: {
    labels?: Label[];
    sources?: string[];
    category?: string;
  };
  searchQuery?: string;
  limit?: number;
}

const STORIES_QUERY_KEY = 'stories';

export function useStories(options: UseStoriesOptions = {}) {
  const { sortBy = 'hot', filters = {}, searchQuery, limit = 20 } = options;

  return useInfiniteQuery({
    queryKey: [STORIES_QUERY_KEY, { sortBy, filters, searchQuery }],
    queryFn: async ({ pageParam = 1 }) => {
      const queryParams = new URLSearchParams();
      queryParams.set('page', String(pageParam));
      queryParams.set('limit', String(limit));
      queryParams.set('sort', sortBy);
      
      if (filters.labels?.length) {
        filters.labels.forEach((label) => queryParams.append('label', label));
      }
      if (filters.sources?.length) {
        filters.sources.forEach((source) => queryParams.append('source', source));
      }
      if (filters.category) {
        queryParams.set('category', filters.category);
      }
      if (searchQuery) {
        queryParams.set('q', searchQuery);
      }

      const response = await api.get<PaginatedStories>(`/v1/stories?${queryParams}`);
      return response;
    },
    getNextPageParam: (lastPage) => {
      if (lastPage.page >= lastPage.totalPages) return undefined;
      return lastPage.page + 1;
    },
    initialPageParam: 1,
  });
}

export function useStory(id: string) {
  return useQuery({
    queryKey: [STORIES_QUERY_KEY, id],
    queryFn: async () => {
      const response = await api.get<Story>(`/v1/stories/${id}`);
      return response;
    },
    enabled: !!id,
  });
}

export function useCategories() {
  return useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const response = await api.get<Array<{ name: string; count: number }>>('/v1/stories/categories');
      return response;
    },
  });
}
