'use client';

import { useFeedStore } from '@/store/feed-store';
import { cn, capitalize } from '@/lib/utils';
import type { Label } from '@rafineri/shared';

const labels: { value: Label; label: string; color: string }[] = [
  { value: 'verified', label: 'Verified', color: 'bg-verified' },
  { value: 'likely', label: 'Likely', color: 'bg-likely' },
  { value: 'contested', label: 'Contested', color: 'bg-contested' },
  { value: 'unverified', label: 'Unverified', color: 'bg-unverified' },
];

export function LabelFilter() {
  const { filters, toggleLabel } = useFeedStore();

  return (
    <>
      {labels.map(({ value, label, color }) => {
        const isActive = filters.labels.includes(value);
        return (
          <button
            key={value}
            onClick={() => toggleLabel(value)}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-all whitespace-nowrap',
              isActive
                ? 'bg-foreground text-background'
                : 'bg-muted text-muted-foreground hover:bg-muted/80'
            )}
          >
            <span className={cn('w-2 h-2 rounded-full', color)} />
            {label}
          </button>
        );
      })}
    </>
  );
}
