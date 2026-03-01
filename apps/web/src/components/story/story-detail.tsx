'use client';

import Image from 'next/image';
import type { Story, Claim, Evidence } from '@rafineri/shared';
import { cn, formatDate, getLabelColor, capitalize } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  FileText,
  AlertTriangle,
  Clock,
  ExternalLink,
  CheckCircle2,
  XCircle,
  MinusCircle,
  Newspaper,
  MessageSquare,
  Hand,
  Calendar,
  Tag,
} from 'lucide-react';

interface StoryDetailProps {
  story: Story;
}

const sourceIcons = {
  hn: Newspaper,
  reddit: MessageSquare,
  manual: Hand,
};

const sourceLabels = {
  hn: 'Hacker News',
  reddit: 'Reddit',
  manual: 'Manually Added',
};

// Mock claims data for demo
const mockClaims: Claim[] = [
  {
    id: 'c1',
    story_id: 's1',
    text: 'The new solar cell technology achieves 40% efficiency',
    type: 'fact',
    status: 'verified',
    confidence: 0.95,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c2',
    story_id: 's1',
    text: 'MIT researchers developed the technology',
    type: 'fact',
    status: 'verified',
    confidence: 0.98,
    created_at: new Date().toISOString(),
  },
  {
    id: 'c3',
    story_id: 's1',
    text: 'This will revolutionize the energy sector within 2 years',
    type: 'prediction',
    status: 'unverified',
    confidence: 0.3,
    created_at: new Date().toISOString(),
  },
];

// Mock evidence data for demo
const mockEvidence: Evidence[] = [
  {
    id: 'e1',
    story_id: 's1',
    url: 'https://news.mit.edu/2024/solar-cell-breakthrough',
    title: 'MIT News: Solar Cell Breakthrough',
    stance: 'supporting',
    source: 'MIT News',
    credibility: 0.95,
    snippet: 'MIT researchers announced a breakthrough in solar cell efficiency...',
    created_at: new Date().toISOString(),
  },
  {
    id: 'e2',
    story_id: 's1',
    url: 'https://nature.com/articles/solar-efficiency',
    title: 'Nature: Review of Solar Cell Efficiency Claims',
    stance: 'neutral',
    source: 'Nature',
    credibility: 0.98,
    snippet: 'A comprehensive review of recent claims about solar efficiency...',
    created_at: new Date().toISOString(),
  },
  {
    id: 'e3',
    story_id: 's1',
    url: 'https://example.com/skeptic',
    title: 'Skeptical Analysis of Efficiency Claims',
    stance: 'against',
    source: 'Independent Blog',
    credibility: 0.6,
    snippet: 'Critical examination of the efficiency claims...',
    created_at: new Date().toISOString(),
  },
];

export function StoryDetail({ story }: StoryDetailProps) {
  const labelColors = getLabelColor(story.label);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-4">
        {/* Image */}
        {story.imageUrl && (
          <div className="relative w-full aspect-[21/9] rounded-lg overflow-hidden bg-muted">
            <Image
              src={story.imageUrl}
              alt={story.title}
              fill
              className="object-cover"
              priority
            />
            <div className="absolute top-4 left-4">
              <div className="flex items-center gap-2 bg-white/95 backdrop-blur px-3 py-1.5 rounded-full shadow-sm">
                <span
                  className={cn(
                    'w-2.5 h-2.5 rounded-full',
                    labelColors.bg.replace('/10', '')
                  )}
                />
                <span className="font-bold text-sm">
                  {story.score}/100
                </span>
                <Badge variant={story.label}>{story.label}</Badge>
              </div>
            </div>
          </div>
        )}

        {/* Title & Meta */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Badge variant="outline">{story.category}</Badge>
            <span>•</span>
            <span className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              {formatDate(story.publishedAt)}
            </span>
          </div>

          <h1 className="text-2xl md:text-3xl font-bold">{story.title}</h1>

          {story.summary && (
            <p className="text-lg text-muted-foreground leading-relaxed">
              {story.summary}
            </p>
          )}

          {/* Sources */}
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {story.seenOn.map((source) => {
              const Icon = sourceIcons[source];
              return (
                <div
                  key={source}
                  className="flex items-center gap-1.5 text-sm text-muted-foreground bg-muted px-2.5 py-1 rounded-md"
                >
                  <Icon className="h-4 w-4" />
                  <span>{sourceLabels[source]}</span>
                </div>
              );
            })}
            {story.url && (
              <a
                href={story.url}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 text-sm text-primary hover:underline ml-auto"
              >
                <ExternalLink className="h-4 w-4" />
                Original Source
              </a>
            )}
          </div>
        </div>
      </div>

      {/* Label Explanation */}
      <Card className={cn('border-l-4', labelColors.border.replace('/30', ''))}>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Badge variant={story.label} className="shrink-0 mt-0.5">
              {story.label}
            </Badge>
            <p className="text-sm text-muted-foreground">
              {labelColors.description}
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          icon={FileText}
          label="Evidence"
          value={story.evidenceCount}
        />
        <StatCard
          icon={AlertTriangle}
          label="Contradictions"
          value={story.contradictionsCount}
          variant="warning"
        />
        <StatCard
          icon={CheckCircle2}
          label="Verified Claims"
          value={mockClaims.filter((c) => c.status === 'verified').length}
          variant="success"
        />
        <StatCard
          icon={Tag}
          label="Category"
          value={story.category}
        />
      </div>

      {/* Tabs */}
      <Tabs value="claims" onValueChange={() => {}} className="w-full">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="claims">Claims</TabsTrigger>
          <TabsTrigger value="evidence">Evidence</TabsTrigger>
          <TabsTrigger value="timeline">Timeline</TabsTrigger>
        </TabsList>

        <TabsContent value="claims" className="space-y-4">
          {mockClaims.map((claim) => (
            <ClaimCard key={claim.id} claim={claim} />
          ))}
        </TabsContent>

        <TabsContent value="evidence" className="space-y-4">
          <div className="grid gap-4">
            {mockEvidence.map((evidence) => (
              <EvidenceCard key={evidence.id} evidence={evidence} />
            ))}
          </div>
        </TabsContent>

        <TabsContent value="timeline">
          <Timeline events={[
            { date: story.publishedAt, event: 'Story published' },
            { date: story.createdAt, event: 'Added to Rafineri' },
            { date: story.updatedAt, event: 'Last updated' },
          ]} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function StatCard({
  icon: Icon,
  label,
  value,
  variant = 'default',
}: {
  icon: React.ElementType;
  label: string;
  value: string | number;
  variant?: 'default' | 'warning' | 'success' | 'error';
}) {
  const variantStyles = {
    default: 'text-muted-foreground',
    warning: 'text-contested',
    success: 'text-verified',
    error: 'text-destructive',
  };

  return (
    <div className="bg-muted/50 rounded-lg p-4 flex items-center gap-3">
      <Icon className={cn('h-5 w-5', variantStyles[variant])} />
      <div>
        <p className="text-xs text-muted-foreground uppercase">{label}</p>
        <p className="font-semibold">{value}</p>
      </div>
    </div>
  );
}

function ClaimCard({ claim }: { claim: Claim }) {
  const statusIcons = {
    verified: CheckCircle2,
    disputed: AlertTriangle,
    debunked: XCircle,
    unverified: MinusCircle,
  };

  const statusColors = {
    verified: 'text-verified bg-verified/10',
    disputed: 'text-contested bg-contested/10',
    debunked: 'text-destructive bg-destructive/10',
    unverified: 'text-unverified bg-unverified/10',
  };

  const Icon = statusIcons[claim.status];

  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border bg-card">
      <div
        className={cn(
          'p-2 rounded-full shrink-0',
          statusColors[claim.status].split(' ')[1]
        )}
      >
        <Icon
          className={cn('h-4 w-4', statusColors[claim.status].split(' ')[0])}
        />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-medium">{claim.text}</p>
        <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground">
          <Badge variant="outline" className="text-xs">
            {claim.status}
          </Badge>
          <span>Confidence: {Math.round(claim.confidence * 100)}%</span>
        </div>
      </div>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: Evidence }) {
  const stanceStyles = {
    supporting: 'border-verified/30 bg-verified/5',
    against: 'border-destructive/30 bg-destructive/5',
    neutral: 'border-muted bg-muted/30',
  };

  const stanceLabels = {
    supporting: 'Supporting',
    against: 'Against',
    neutral: 'Neutral',
  };

  return (
    <a
      href={evidence.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        'block p-4 rounded-lg border transition-colors hover:shadow-sm',
        stanceStyles[evidence.stance]
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <h4 className="font-medium line-clamp-1">{evidence.title}</h4>
          <p className="text-sm text-muted-foreground mt-1">
            {evidence.source}
          </p>
        </div>
        <Badge variant="outline" className="shrink-0">
          {stanceLabels[evidence.stance]}
        </Badge>
      </div>
      <div className="flex items-center justify-between mt-3 text-xs text-muted-foreground">
        <span>Credibility: {Math.round(evidence.credibility * 100)}%</span>
        <ExternalLink className="h-3.5 w-3.5" />
      </div>
    </a>
  );
}

function Timeline({ events }: { events: { date: string; event: string }[] }) {
  return (
    <div className="space-y-0">
      {events.map((item, index) => (
        <div key={index} className="flex gap-4">
          <div className="flex flex-col items-center">
            <div className="w-2 h-2 rounded-full bg-primary" />
            {index < events.length - 1 && (
              <div className="w-px h-full bg-border my-1" />
            )}
          </div>
          <div className="pb-6">
            <p className="text-sm font-medium">{item.event}</p>
            <p className="text-xs text-muted-foreground">
              {formatDate(item.date, 'PPp')}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
