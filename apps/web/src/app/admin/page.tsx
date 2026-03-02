'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { api } from '@/lib/admin-api';
import {
  FileText,
  Clock,
  AlertCircle,
  Activity,
  TrendingUp,
  CheckCircle2,
} from 'lucide-react';

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
  recentActivity: Array<{
    id: string;
    type: 'story_created' | 'story_updated' | 'ingestion';
    message: string;
    timestamp: string;
  }>;
}

export default function AdminDashboard() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchStats();
    const interval = setInterval(fetchStats, 30000); // Refresh every 30s
    return () => clearInterval(interval);
  }, []);

  async function fetchStats() {
    try {
      const data = await api.get<DashboardStats>('/v1/admin/dashboard');
      setStats(data);
      setError(null);
    } catch (err) {
      setError('Failed to load dashboard stats');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/20 rounded-lg">
        <AlertCircle className="h-5 w-5" />
        <p>{error}</p>
      </div>
    );
  }

  const healthColor = {
    healthy: 'bg-green-500',
    degraded: 'bg-yellow-500',
    down: 'bg-red-500',
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground">
          Overview of system health and activity
        </p>
      </div>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Stories</CardTitle>
            <FileText className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.totalStories ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              All time stories
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Stories Today</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.storiesToday ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Created in last 24h
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Pending Review</CardTitle>
            <Clock className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.pendingReview ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Awaiting moderation
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Sources</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {(stats?.totalSources ?? 0).toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              Active sources
            </p>
          </CardContent>
        </Card>
      </div>

      {/* System Health */}
      <Card>
        <CardHeader>
          <CardTitle>System Health</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            {stats?.systemHealth && Object.entries(stats.systemHealth).map(([service, status]) => (
              <div key={service} className="flex items-center gap-2">
                <div className={cn('h-3 w-3 rounded-full', healthColor[status])} />
                <span className="text-sm capitalize">{service}</span>
                <Badge variant={status === 'healthy' ? 'default' : 'destructive'}>
                  {status}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Activity</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {stats?.recentActivity.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recent activity</p>
            ) : (
              stats?.recentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  {activity.type === 'story_created' && (
                    <FileText className="h-4 w-4 text-blue-500 mt-0.5" />
                  )}
                  {activity.type === 'story_updated' && (
                    <CheckCircle2 className="h-4 w-4 text-green-500 mt-0.5" />
                  )}
                  {activity.type === 'ingestion' && (
                    <Activity className="h-4 w-4 text-purple-500 mt-0.5" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm">{activity.message}</p>
                    <p className="text-xs text-muted-foreground">
                      {activity.timestamp ? new Date(activity.timestamp).toLocaleString() : 'Unknown'}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function cn(...classes: (string | undefined)[]) {
  return classes.filter(Boolean).join(' ');
}
