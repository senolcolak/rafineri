'use client';

import { useFeedStore, ViewMode } from '@/store/feed-store';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { LayoutGrid, List } from 'lucide-react';

export function FeedToolbar() {
  const { viewMode, setViewMode } = useFeedStore();

  return (
    <div className="flex items-center justify-between mb-4">
      <h2 className="text-lg font-semibold">Stories</h2>
      <div className="flex items-center gap-2">
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
      </div>
    </div>
  );
}

function ViewToggle({
  viewMode,
  onChange,
}: {
  viewMode: ViewMode;
  onChange: (mode: ViewMode) => void;
}) {
  return (
    <div className="flex items-center gap-1 bg-muted rounded-md p-1">
      <button
        onClick={() => onChange('list')}
        className={cn(
          'p-1.5 rounded transition-colors',
          viewMode === 'list'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
        aria-label="List view"
      >
        <List className="h-4 w-4" />
      </button>
      <button
        onClick={() => onChange('grid')}
        className={cn(
          'p-1.5 rounded transition-colors',
          viewMode === 'grid'
            ? 'bg-background shadow-sm text-foreground'
            : 'text-muted-foreground hover:text-foreground'
        )}
        aria-label="Grid view"
      >
        <LayoutGrid className="h-4 w-4" />
      </button>
    </div>
  );
}
