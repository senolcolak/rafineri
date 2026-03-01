'use client';

import Link from 'next/link';
import Image from 'next/image';
import type { Story } from '@rafineri/shared';
import { ViewMode } from '@/store/feed-store';
import { cn, formatRelativeTime, getLabelColor, getScoreBgColor } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { FileText, AlertTriangle, Clock, Newspaper, MessageSquare, Hand } from 'lucide-react';

interface StoryCardProps {
  story: Story;
  viewMode: ViewMode;
}

const sourceIcons = {
  hn: Newspaper,
  reddit: MessageSquare,
  manual: Hand,
};

export function StoryCard({ story, viewMode }: StoryCardProps) {
  const labelColors = getLabelColor(story.label);
  const isGrid = viewMode === 'grid';

  return (
    <Link href={`/story/${story.id}`}>
      <article
        className={cn(
          'group relative bg-card rounded-lg border shadow-sm hover:shadow-md transition-all hover:border-primary/20 overflow-hidden',
          isGrid ? 'flex flex-col' : 'flex gap-4 p-4'
        )}
      >
        {/* Rating Pill */}
        <div
          className={cn(
            'absolute z-10 flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold shadow-sm',
            'bg-white/95 backdrop-blur text-foreground',
            isGrid ? 'top-3 left-3' : 'top-3 left-3'
          )}
        >
          <span
            className={cn(
              'w-2 h-2 rounded-full',
              getScoreBgColor(story.score)
            )}
          />
          <span className="tabular-nums">{story.score}</span>
          <Badge variant={story.label} className="ml-1 text-[10px] px-1.5 py-0">
            {story.label}
          </Badge>
        </div>

        {/* Thumbnail */}
        <div
          className={cn(
            'relative bg-muted overflow-hidden shrink-0',
            isGrid
              ? 'w-full aspect-[16/10]'
              : 'w-32 h-24 md:w-40 md:h-28 rounded-md'
          )}
        >
          {story.imageUrl ? (
            <Image
              src={story.imageUrl}
              alt={story.title}
              fill
              className="object-cover transition-transform group-hover:scale-105"
              sizes={isGrid ? '(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 33vw' : '160px'}
            />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center">
              <FileText className="h-8 w-8 text-muted-foreground/50" />
            </div>
          )}
        </div>

        {/* Content */}
        <div className={cn('flex-1 min-w-0', isGrid && 'p-4 pt-3')}>
          {/* Category */}
          <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">
            {story.category}
          </p>

          {/* Title */}
          <h3
            className={cn(
              'font-semibold text-foreground line-clamp-2 group-hover:text-primary transition-colors',
              isGrid ? 'text-base' : 'text-base md:text-lg'
            )}
          >
            {story.title}
          </h3>

          {/* Summary */}
          {story.summary && (
            <p
              className={cn(
                'text-sm text-muted-foreground mt-1.5 line-clamp-2',
                isGrid && 'hidden sm:block'
              )}
            >
              {story.summary}
            </p>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 mt-3 text-xs text-muted-foreground">
            {/* Time */}
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5" />
              {formatRelativeTime(story.publishedAt)}
            </span>

            {/* Evidence */}
            {story.evidenceCount > 0 && (
              <span className="flex items-center gap-1">
                <FileText className="h-3.5 w-3.5" />
                {story.evidenceCount}
              </span>
            )}

            {/* Contradictions */}
            {story.contradictionsCount > 0 && (
              <span className="flex items-center gap-1 text-contested">
                <AlertTriangle className="h-3.5 w-3.5" />
                {story.contradictionsCount}
              </span>
            )}

            {/* Sources */}
            <span className="flex items-center gap-1 ml-auto">
              {story.seenOn.map((source) => {
                const Icon = sourceIcons[source];
                return (
                  <Icon
                    key={source}
                    className="h-3.5 w-3.5"
                    aria-label={source}
                  />
                );
              })}
            </span>
          </div>
        </div>
      </article>
    </Link>
  );
}
