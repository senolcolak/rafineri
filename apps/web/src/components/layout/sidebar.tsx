'use client';

import { useCategories } from '@/hooks/use-stories';
import { useFeedStore } from '@/store/feed-store';
import { cn } from '@/lib/utils';
import {
  FolderOpen,
  Newspaper,
  MessageSquare,
  Hand,
  Check,
  Loader2,
} from 'lucide-react';

const sourceIcons = {
  hn: Newspaper,
  reddit: MessageSquare,
  manual: Hand,
};

const sourceLabels = {
  hn: 'Hacker News',
  reddit: 'Reddit',
  manual: 'Manual',
};

export function Sidebar() {
  const { data: categories, isLoading: categoriesLoading } = useCategories();
  const {
    filters,
    toggleSource,
    setCategory,
    isMobileFiltersOpen,
    closeMobileFilters,
  } = useFeedStore();

  const sidebarContent = (
    <>
      {/* Categories */}
      <div className="mb-6">
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          Categories
        </h3>
        {categoriesLoading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <nav className="space-y-1">
            <button
              onClick={() => setCategory(undefined)}
              className={cn(
                'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors',
                !filters.category
                  ? 'bg-primary/10 text-primary font-medium'
                  : 'text-foreground hover:bg-muted'
              )}
            >
              <span className="flex items-center gap-2">
                <FolderOpen className="h-4 w-4" />
                All Categories
              </span>
              <span className="text-xs text-muted-foreground">
                {categories?.reduce((acc, c) => acc + c.count, 0) || 0}
              </span>
            </button>
            {categories?.map((category) => (
              <button
                key={category.name}
                onClick={() => setCategory(category.name)}
                className={cn(
                  'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors',
                  filters.category === category.name
                    ? 'bg-primary/10 text-primary font-medium'
                    : 'text-foreground hover:bg-muted'
                )}
              >
                <span>{category.name}</span>
                <span className="text-xs text-muted-foreground tabular-nums">
                  {category.count}
                </span>
              </button>
            ))}
          </nav>
        )}
      </div>

      {/* Sources */}
      <div>
        <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider mb-3 px-2">
          Sources
        </h3>
        <nav className="space-y-1">
          {(Object.keys(sourceIcons) as Array<keyof typeof sourceIcons>).map(
            (source) => {
              const Icon = sourceIcons[source];
              const isActive = filters.sources.includes(source);
              return (
                <button
                  key={source}
                  onClick={() => toggleSource(source)}
                  className={cn(
                    'w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition-colors',
                    isActive
                      ? 'text-foreground hover:bg-muted'
                      : 'text-muted-foreground hover:bg-muted'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="h-4 w-4" />
                    {sourceLabels[source]}
                  </span>
                  <div
                    className={cn(
                      'w-4 h-4 rounded border flex items-center justify-center transition-colors',
                      isActive
                        ? 'bg-primary border-primary'
                        : 'border-muted-foreground/30'
                    )}
                  >
                    {isActive && <Check className="h-3 w-3 text-primary-foreground" />}
                  </div>
                </button>
              );
            }
          )}
        </nav>
      </div>
    </>
  );

  return (
    <>
      {/* Desktop Sidebar */}
      <aside className="hidden lg:block fixed left-0 top-14 w-64 h-[calc(100vh-3.5rem)] border-r bg-muted/30 overflow-y-auto p-4">
        {sidebarContent}
      </aside>

      {/* Mobile Drawer */}
      {isMobileFiltersOpen && (
        <>
          <div
            className="fixed inset-0 bg-black/50 z-40 lg:hidden"
            onClick={closeMobileFilters}
          />
          <div className="fixed left-0 top-0 bottom-0 w-72 bg-background z-50 lg:hidden overflow-y-auto p-4 shadow-xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="font-bold text-lg">Filters</h2>
              <button
                onClick={closeMobileFilters}
                className="p-2 hover:bg-muted rounded-md"
              >
                <span className="sr-only">Close</span>
                <svg
                  className="w-5 h-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M6 18L18 6M6 6l12 12"
                  />
                </svg>
              </button>
            </div>
            {sidebarContent}
          </div>
        </>
      )}
    </>
  );
}
