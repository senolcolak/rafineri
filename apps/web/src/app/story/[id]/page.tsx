'use client';

import { useStory } from '@/hooks/use-stories';
import { StoryDetail } from '@/components/story/story-detail';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useParams } from 'next/navigation';

export default function StoryPage() {
  const params = useParams();
  const id = params.id as string;
  const { data: story, isLoading, error } = useStory(id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[calc(100vh-3.5rem)]">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error || !story) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[calc(100vh-3.5rem)] p-6">
        <h1 className="text-2xl font-bold mb-2">Story not found</h1>
        <p className="text-muted-foreground mb-6">
          The story you&apos;re looking for doesn&apos;t exist or has been removed.
        </p>
        <Link href="/">
          <Button>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to feed
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-6 max-w-5xl mx-auto">
      <Link
        href="/"
        className="inline-flex items-center text-sm text-muted-foreground hover:text-foreground mb-6 transition-colors"
      >
        <ArrowLeft className="h-4 w-4 mr-2" />
        Back to feed
      </Link>
      <StoryDetail story={story} />
    </div>
  );
}
