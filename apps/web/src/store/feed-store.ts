import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Label } from '@rafineri/shared';

export type ViewMode = 'list' | 'grid';
export type SortOption = 'hot' | 'verified' | 'contested' | 'newest';
export type SourceType = 'hn' | 'reddit' | 'manual';

interface Filters {
  labels: Label[];
  sources: SourceType[];
  category?: string;
}

interface FeedState {
  viewMode: ViewMode;
  sortBy: SortOption;
  filters: Filters;
  searchQuery: string;
  isMobileFiltersOpen: boolean;
  
  // Actions
  setViewMode: (mode: ViewMode) => void;
  setSortBy: (sort: SortOption) => void;
  toggleLabel: (label: Label) => void;
  toggleSource: (source: SourceType) => void;
  setCategory: (category?: string) => void;
  setSearchQuery: (query: string) => void;
  clearFilters: () => void;
  openMobileFilters: () => void;
  closeMobileFilters: () => void;
}

const initialFilters: Filters = {
  labels: [],
  sources: ['hn', 'reddit', 'manual'],
};

export const useFeedStore = create<FeedState>()(
  persist(
    (set) => ({
      viewMode: 'list',
      sortBy: 'hot',
      filters: initialFilters,
      searchQuery: '',
      isMobileFiltersOpen: false,

      setViewMode: (mode) => set({ viewMode: mode }),
      
      setSortBy: (sort) => set({ sortBy: sort }),
      
      toggleLabel: (label) =>
        set((state) => ({
          filters: {
            ...state.filters,
            labels: state.filters.labels.includes(label)
              ? state.filters.labels.filter((l) => l !== label)
              : [...state.filters.labels, label],
          },
        })),
      
      toggleSource: (source) =>
        set((state) => ({
          filters: {
            ...state.filters,
            sources: state.filters.sources.includes(source)
              ? state.filters.sources.filter((s) => s !== source)
              : [...state.filters.sources, source],
          },
        })),
      
      setCategory: (category) =>
        set((state) => ({
          filters: { ...state.filters, category },
        })),
      
      setSearchQuery: (query) => set({ searchQuery: query }),
      
      clearFilters: () =>
        set({
          filters: initialFilters,
          searchQuery: '',
        }),
      
      openMobileFilters: () => set({ isMobileFiltersOpen: true }),
      closeMobileFilters: () => set({ isMobileFiltersOpen: false }),
    }),
    {
      name: 'rafineri-feed-store',
      partialize: (state) => ({
        viewMode: state.viewMode,
        sortBy: state.sortBy,
      }),
    }
  )
);
