'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { adminApi } from '@/lib/admin-api';
import { 
  FileText, 
  TrendingUp, 
  Users, 
  Activity, 
  AlertCircle,
  RefreshCw,
  CheckCircle2,
  XCircle,
  Clock
} from 'lucide-react';
import type { Story } from '@rafineri/shared';

interface DashboardStats {
  totalStories: number;
  storiesToday: number;
  pendingReview: number;
  totalSources: number;
  systemHealth: {
    api: 'healthy' | 'degraded' | 'down';
    worker: 'healthy' | 'degraded' | 'down';
    database: 'healthy' | 'degraded' | 'down';
  };
}

interface StoriesResponse {
  stories: Story[];
  total: number;
  page: number;
  totalPages: number;
}

export default function AdminAnalyticsPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [stories, setStories] = useState<Story[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  async function fetchData() {
    try {
      setLoading(true);
      setError(null);
      
      // Fetch dashboard stats and recent stories in parallel
      const [statsData, storiesData] = await Promise.all([
        adminApi.getHealth().then(health => ({
          totalStories: 0, // Will be filled from stories data
          storiesToday: 0,
          pendingReview: 0,
          totalSources: 0,
          systemHealth: {
            api: health?.status === 'healthy' ? 'healthy' as const : 'degraded' as const,
            worker: health?.services?.redis === 'healthy' ? 'healthy' as const : 'degraded' as const,
            database: health?.services?.database === 'healthy' ? 'healthy' as const : 'down' as const,
          }
        })),
        adminApi.getStories({ page: 1, limit: 100 }),
      ]);

      // Calculate real metrics from stories
      const storiesByLabel = storiesData.stories.reduce((acc, story) => {
        acc[story.label] = (acc[story.label] || 0) + 1;
        return acc;
      }, {} as Record<string, number>);

      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const storiesToday = (storiesData.stories ?? []).filter(s => {
        const storyDate = new Date(s.created_at);
        return storyDate >= today;
      }).length;

      setStats({
        ...statsData,
        totalStories: storiesData.total,
        storiesToday,
        pendingReview: storiesByLabel['unverified'] || 0,
      });
      setStories(storiesData.stories.slice(0, 10));
    } catch (err) {
      setError('Failed to load analytics data');
      console.error(err);
    } finally {
      setLoading(false);
    }
  }

  function getLabelStats() {
    const stats = (stories ?? []).reduce((acc, story) => {
      acc[story.label] = (acc[story.label] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    return [
      { label: 'Verified', count: stats['verified'] || 0, color: 'bg-green-500' },
      { label: 'Likely', count: stats['likely'] || 0, color: 'bg-blue-500' },
      { label: 'Contested', count: stats['contested'] || 0, color: 'bg-yellow-500' },
      { label: 'Unverified', count: stats['unverified'] || 0, color: 'bg-gray-500' },
    ];
  }

  function getHealthColor(status: string) {
    switch (status) {
      case 'healthy': return 'bg-green-500';
      case 'degraded': return 'bg-yellow-500';
      case 'down': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  }

  function getHealthIcon(status: string) {
    switch (status) {
      case 'healthy': return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'degraded': return <AlertCircle className="h-4 w-4 text-yellow-500" />;
      case 'down': return <XCircle className="h-4 w-4 text-red-500" />;
      default: return <Activity className="h-4 w-4 text-gray-500" />;
    }
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">System performance and metrics</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Analytics</h1>
            <p className="text-muted-foreground">System performance and metrics</p>
          </div>
          <Button onClick={fetchData} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Retry
          </Button>
        </div>
        <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      </div>
    );
  }

  const labelStats = getLabelStats();

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Analytics</h1>
          <p className="text-muted-foreground">System performance and metrics</p>
        </div>
        <Button onClick={fetchData} variant="outline" disabled={loading}>
          <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stories</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.totalStories ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">All time stories</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stories Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.storiesToday ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Created in last 24h</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{(stats?.pendingReview ?? 0).toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Awaiting moderation</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Status</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center gap-2">
              <div className={`h-2 w-2 rounded-full ${getHealthColor(stats?.systemHealth.api || 'down')}`} />
              <span className="text-2xl font-bold capitalize">{stats?.systemHealth.api}</span>
            </div>
            <p className="text-xs text-muted-foreground">Overall system health</p>
          </CardContent>
        </Card>
      </div>

      {/* Label Distribution */}
      <Card>
        <CardHeader>
          <CardTitle>Story Label Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {labelStats.map((stat) => (
              <div key={stat.label} className="flex items-center gap-3 p-3 border rounded-lg">
                <div className={`h-3 w-3 rounded-full ${stat.color}`} />
                <div>
                  <p className="font-medium">{stat.count}</p>
                  <p className="text-xs text-muted-foreground">{stat.label}</p>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-4">
            {stats?.systemHealth && Object.entries(stats.systemHealth).map(([service, status]) => (
              <div key={service} className="flex items-center gap-2 p-3 border rounded-lg">
                {getHealthIcon(status)}
                <span className="text-sm font-medium capitalize">{service}</span>
                <Badge variant={status === 'healthy' ? 'default' : status === 'degraded' ? 'secondary' : 'destructive'}>
                  {status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Stories */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Stories</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {(stories?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No stories found</p>
            ) : (
              (stories ?? []).slice(0, 5).map((story) => (
                <div key={story.id} className="flex items-center justify-between p-3 border rounded-lg">
                  <div className="flex-1 min-w-0">
                    <p className="font-medium truncate">{story.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {new Date(story.created_at).toLocaleDateString()} • {story.category || 'General'}
                    </p>
                  </div>
                  <Badge variant={story.label === 'verified' ? 'default' : story.label === 'contested' ? 'secondary' : 'outline'}>
                    {story.label}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
