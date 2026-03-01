'use client';

import { useStories } from '@/hooks/use-stories';
import { StoryCard } from '@/components/story/story-card';
import { FeedToolbar } from '@/components/feed/feed-toolbar';
import { useFeedStore } from '@/store/feed-store';
import { useInView } from '@/hooks/use-in-view';
import { useEffect } from 'react';
import { Loader2 } from 'lucide-react';

export default function HomePage() {
  const { viewMode, sortBy, filters, searchQuery } = useFeedStore();
  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, isLoading } =
    useStories({
      sortBy,
      filters,
      searchQuery,
    });

  const { ref, inView } = useInView({ threshold: 0 });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const stories = data?.pages.flatMap((page) => page.stories) ?? [];

  return (
    <div className="p-4 md:p-6 max-w-7xl mx-auto">
      <FeedToolbar />

      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : stories.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <p className="text-lg font-medium text-muted-foreground">
            No stories found
          </p>
          <p className="text-sm text-muted-foreground/70 mt-1">
            Try adjusting your filters or search query
          </p>
        </div>
      ) : (
        <div
          className={
            viewMode === 'grid'
              ? 'grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4'
              : 'flex flex-col gap-4'
          }
        >
          {stories.map((story) => (
            <StoryCard key={story.id} story={story} viewMode={viewMode} />
          ))}
        </div>
      )}

      {/* Infinite scroll sentinel */}
      {hasNextPage && (
        <div ref={ref} className="flex items-center justify-center py-8">
          {isFetchingNextPage && (
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          )}
        </div>
      )}
    </div>
  );
}
