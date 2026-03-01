'use client';

import { Search, Menu, Filter, X } from 'lucide-react';
import Link from 'next/link';
import { useFeedStore } from '@/store/feed-store';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { LabelFilter } from '@/components/feed/label-filter';
import { cn } from '@/lib/utils';

const sortOptions = [
  { value: 'hot', label: 'Hot' },
  { value: 'verified', label: 'Most Verified' },
  { value: 'contested', label: 'Most Contested' },
  { value: 'newest', label: 'Newest' },
] as const;

export function TopBar() {
  const {
    sortBy,
    setSortBy,
    searchQuery,
    setSearchQuery,
    filters,
    clearFilters,
    openMobileFilters,
    isMobileFiltersOpen,
    closeMobileFilters,
  } = useFeedStore();

  const hasActiveFilters =
    filters.labels.length > 0 ||
    filters.sources.length < 3 ||
    filters.category;

  return (
    <>
      <header className="fixed top-0 left-0 right-0 z-50 bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60 border-b">
        <div className="flex items-center gap-2 h-14 px-3 md:px-4">
          {/* Mobile menu button */}
          <Button
            variant="ghost"
            size="icon"
            className="lg:hidden"
            onClick={() =>
              isMobileFiltersOpen ? closeMobileFilters() : openMobileFilters()
            }
            aria-label="Toggle menu"
          >
            {isMobileFiltersOpen ? (
              <X className="h-5 w-5" />
            ) : (
              <Menu className="h-5 w-5" />
            )}
          </Button>

          {/* Brand */}
          <a
            href="/"
            className="flex items-center gap-2 font-bold text-lg md:text-xl tracking-tight shrink-0"
          >
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary to-primary/70 flex items-center justify-center text-primary-foreground text-sm font-bold">
              R
            </div>
            <span className="hidden sm:inline">Rafineri</span>
          </a>

          {/* Search */}
          <div className="flex-1 max-w-md mx-2 md:mx-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="search"
                placeholder="Search stories..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 w-full"
              />
            </div>
          </div>

          {/* Desktop sort dropdown */}
          <div className="hidden md:block shrink-0">
            <Select value={sortBy} onValueChange={(v) => setSortBy(v as typeof sortBy)}>
              <SelectTrigger className="w-[160px] h-9">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {sortOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Mobile filters button */}
          <Button
            variant="outline"
            size="sm"
            className="md:hidden shrink-0"
            onClick={openMobileFilters}
          >
            <Filter className="h-4 w-4 mr-2" />
            Filters
            {hasActiveFilters && (
              <span className="ml-2 w-2 h-2 rounded-full bg-primary" />
            )}
          </Button>

          {/* Clear filters */}
          {hasActiveFilters && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearFilters}
              className="hidden md:flex shrink-0"
            >
              Clear
            </Button>
          )}


        </div>

        {/* Label filter chips - desktop */}
        <div className="hidden md:block border-t">
          <div className="flex items-center gap-2 px-4 py-2 overflow-x-auto no-scrollbar">
            <LabelFilter />
          </div>
        </div>
      </header>
    </>
  );
}
