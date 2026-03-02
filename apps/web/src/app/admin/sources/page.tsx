'use client';

import { useEffect, useState } from 'react';
import { adminApi } from '@/lib/admin-api';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Newspaper, MessageSquare, Play, Pause, RefreshCw, Loader2 } from 'lucide-react';

interface Source {
  id: string;
  name: string;
  type: string;
  url?: string;
  isActive: boolean;
  lastIngested?: string;
  itemsCount?: number;
}

export default function AdminSourcesPage() {
  const [sources, setSources] = useState<Source[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [triggering, setTriggering] = useState<string | null>(null);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchSources();
  }, []);

  // Clear message after 5 seconds
  useEffect(() => {
    if (message) {
      const timer = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(timer);
    }
  }, [message]);

  async function fetchSources() {
    try {
      setLoading(true);
      const data = await adminApi.getSources();
      setSources(data);
    } catch (error) {
      console.error('Failed to fetch sources:', error);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSource(id: string, isActive: boolean) {
    try {
      setUpdating(id);
      await adminApi.updateSource(id, { isActive });
      setSources((prev) =>
        prev.map((s) => (s.id === id ? { ...s, isActive } : s))
      );
    } catch (error) {
      console.error('Failed to update source:', error);
      setMessage({ type: 'error', text: 'Failed to update source' });
    } finally {
      setUpdating(null);
    }
  }

  async function triggerIngestion(sourceType: 'hackernews' | 'reddit') {
    try {
      setTriggering(sourceType);
      const result = await adminApi.triggerIngestion(sourceType);
      setMessage({ type: 'success', text: result.message || `Triggered ${sourceType} ingestion` });
    } catch (error) {
      console.error(`Failed to trigger ${sourceType} ingestion:`, error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : `Failed to trigger ${sourceType} ingestion` 
      });
    } finally {
      setTriggering(null);
    }
  }

  async function setAllSourcesActive(isActive: boolean) {
    try {
      setTriggering(isActive ? 'resume-all' : 'pause-all');
      const result = isActive 
        ? await adminApi.resumeAllSources()
        : await adminApi.pauseAllSources();
      setMessage({ type: 'success', text: result.message });
      // Refresh sources to show updated states
      await fetchSources();
    } catch (error) {
      console.error('Failed to update sources:', error);
      setMessage({ 
        type: 'error', 
        text: error instanceof Error ? error.message : 'Failed to update sources' 
      });
    } finally {
      setTriggering(null);
    }
  }

  const sourceIcons: Record<string, React.ComponentType<{ className?: string }> | (() => JSX.Element)> = {
    hackernews: Newspaper,
    reddit: MessageSquare,
    manual: () => <span className="text-lg">✋</span>,
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Sources</h1>
          <p className="text-muted-foreground">
            Manage content ingestion sources
          </p>
        </div>
        <Button onClick={fetchSources} variant="outline" size="sm">
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {/* Sources Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        {loading ? (
          <div className="col-span-full text-center py-12">Loading...</div>
        ) : sources.length === 0 ? (
          <div className="col-span-full text-center py-12 text-muted-foreground">
            No sources configured
          </div>
        ) : (
          sources.map((source) => {
            const Icon = sourceIcons[source.type];
            return (
              <Card key={source.id}>
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Icon className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-base">{source.name}</CardTitle>
                        <p className="text-xs text-muted-foreground capitalize">
                          {source.type}
                        </p>
                      </div>
                    </div>
                    <Badge variant={source.isActive ? 'default' : 'secondary'}>
                      {source.isActive ? 'Active' : 'Paused'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="flex justify-between text-sm">
                    <span className="text-muted-foreground">Items ingested</span>
                    <span className="font-medium">{(source.itemsCount || 0).toLocaleString()}</span>
                  </div>
                  {source.lastIngested && (
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Last ingested</span>
                      <span className="font-medium">
                        {new Date(source.lastIngested).toLocaleDateString()}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <span className="text-sm font-medium">Enable ingestion</span>
                    <Switch
                      checked={source.isActive}
                      onCheckedChange={(checked) => toggleSource(source.id, checked)}
                      disabled={updating === source.id}
                    />
                  </div>
                </CardContent>
              </Card>
            );
          })
        )}
      </div>

      {/* Message Display */}
      {message && (
        <div className={`p-4 rounded-lg ${message.type === 'success' ? 'bg-green-500/10 text-green-600 border border-green-500/20' : 'bg-red-500/10 text-red-600 border border-red-500/20'}`}>
          {message.text}
        </div>
      )}

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap gap-2">
            <Button 
              variant="outline" 
              size="sm" 
              onClick={() => triggerIngestion('hackernews')}
              disabled={triggering === 'hackernews'}
            >
              {triggering === 'hackernews' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Trigger HN Ingestion
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => triggerIngestion('reddit')}
              disabled={triggering === 'reddit'}
            >
              {triggering === 'reddit' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Trigger Reddit Ingestion
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setAllSourcesActive(false)}
              disabled={triggering === 'pause-all'}
            >
              {triggering === 'pause-all' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Pause className="mr-2 h-4 w-4" />
              )}
              Pause All Sources
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setAllSourcesActive(true)}
              disabled={triggering === 'resume-all'}
            >
              {triggering === 'resume-all' ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Play className="mr-2 h-4 w-4" />
              )}
              Resume All Sources
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
