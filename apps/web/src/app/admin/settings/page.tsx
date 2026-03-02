'use client';

import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Save, Loader2, AlertCircle, CheckCircle2, RefreshCw } from 'lucide-react';
import { adminApi } from '@/lib/admin-api';

interface Settings {
  // Ingestion Settings
  hnConcurrency: number;
  hnBatchSize: number;
  redditLimit: number;
  
  // Clustering Settings
  similarityThreshold: number;
  timeWindowHours: number;
  
  // Feature Flags
  enableHNIngestion: boolean;
  enableRedditIngestion: boolean;
  enableAutoClustering: boolean;
  enableThumbnailRefresh: boolean;
  
  // Admin Settings
  adminToken: string;
  requireApproval: boolean;
}

const defaultSettings: Settings = {
  hnConcurrency: 5,
  hnBatchSize: 30,
  redditLimit: 25,
  similarityThreshold: 0.75,
  timeWindowHours: 48,
  enableHNIngestion: true,
  enableRedditIngestion: true,
  enableAutoClustering: true,
  enableThumbnailRefresh: true,
  adminToken: '',
  requireApproval: false,
};

export default function AdminSettingsPage() {
  const [settings, setSettings] = useState<Settings>(defaultSettings);
  const [originalSettings, setOriginalSettings] = useState<Settings>(defaultSettings);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('ingestion');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    // Check if settings have changed
    setHasChanges(JSON.stringify(settings) !== JSON.stringify(originalSettings));
  }, [settings, originalSettings]);

  async function fetchSettings() {
    try {
      setLoading(true);
      setError(null);
      
      // Try to fetch settings from API
      try {
        const response = await fetch('/api/admin/settings', {
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${document.cookie.match(/admin_token=([^;]+)/)?.[1] || ''}`,
          },
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.settings) {
            const loadedSettings = { ...defaultSettings, ...data.settings };
            setSettings(loadedSettings);
            setOriginalSettings(loadedSettings);
          }
        }
      } catch {
        // API endpoint not available, use defaults
        console.log('Settings API not available, using defaults');
      }
    } finally {
      setLoading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(null);

    try {
      const response = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'Authorization': `Bearer ${document.cookie.match(/admin_token=([^;]+)/)?.[1] || ''}`,
        },
        body: JSON.stringify(settings),
      });

      if (response.ok) {
        setSuccess('Settings saved successfully');
        setOriginalSettings(settings);
        setHasChanges(false);
      } else {
        const errorData = await response.json().catch(() => ({}));
        setError(errorData.message || 'Failed to save settings. API endpoint may not be implemented yet.');
      }
    } catch (err) {
      setError('Failed to save settings. Settings persistence requires backend API implementation.');
    } finally {
      setSaving(false);
    }
  }

  function handleReset() {
    setSettings(originalSettings);
    setHasChanges(false);
    setError(null);
    setSuccess(null);
  }

  const tabs = [
    { id: 'ingestion', label: 'Ingestion' },
    { id: 'clustering', label: 'Clustering' },
    { id: 'features', label: 'Features' },
    { id: 'admin', label: 'Admin' },
  ];

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold">Settings</h1>
            <p className="text-muted-foreground">Configure system behavior and features</p>
          </div>
        </div>
        <div className="flex items-center justify-center h-64">
          <Loader2 className="h-8 w-8 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">Configure system behavior and features</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={fetchSettings} variant="outline" disabled={loading}>
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={handleReset} variant="outline" disabled={!hasChanges || saving}>
            Reset
          </Button>
          <Button onClick={handleSave} disabled={saving || !hasChanges}>
            {saving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="mr-2 h-4 w-4" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Error/Success Messages */}
      {error && (
        <div className="flex items-center gap-2 text-destructive p-4 border border-destructive/20 rounded-lg">
          <AlertCircle className="h-5 w-5" />
          <p>{error}</p>
        </div>
      )}
      {success && (
        <div className="flex items-center gap-2 text-green-600 p-4 border border-green-200 rounded-lg bg-green-50">
          <CheckCircle2 className="h-5 w-5" />
          <p>{success}</p>
        </div>
      )}

      {/* Unsaved Changes Warning */}
      {hasChanges && !error && !success && (
        <div className="flex items-center gap-2 text-yellow-600 p-4 border border-yellow-200 rounded-lg bg-yellow-50">
          <AlertCircle className="h-5 w-5" />
          <p>You have unsaved changes</p>
        </div>
      )}

      {/* Custom Tabs */}
      <div className="space-y-6">
        <div className="border-b">
          <div className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-2 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-primary text-foreground'
                    : 'border-transparent text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Ingestion Settings */}
        {activeTab === 'ingestion' && (
          <div className="space-y-4">
            <Card>
              <CardHeader>
                <CardTitle>Hacker News Settings</CardTitle>
                <CardDescription>
                  Configure HN content ingestion parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="hnConcurrency">Concurrency</Label>
                    <Input
                      id="hnConcurrency"
                      type="number"
                      min={1}
                      max={20}
                      value={settings.hnConcurrency}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, hnConcurrency: parseInt(e.target.value) || 5 }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of concurrent requests (1-20)
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hnBatchSize">Batch Size</Label>
                    <Input
                      id="hnBatchSize"
                      type="number"
                      min={10}
                      max={100}
                      value={settings.hnBatchSize}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, hnBatchSize: parseInt(e.target.value) || 30 }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Items to fetch per batch (10-100)
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Reddit Settings</CardTitle>
                <CardDescription>
                  Configure Reddit content ingestion parameters
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="redditLimit">Post Limit</Label>
                  <Input
                    id="redditLimit"
                    type="number"
                    min={10}
                    max={100}
                    value={settings.redditLimit}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, redditLimit: parseInt(e.target.value) || 25 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum posts to fetch per subreddit (10-100)
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Clustering Settings */}
        {activeTab === 'clustering' && (
          <Card>
            <CardHeader>
              <CardTitle>Clustering Parameters</CardTitle>
              <CardDescription>
                Configure AI-powered story clustering
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="similarityThreshold">Similarity Threshold</Label>
                  <Input
                    id="similarityThreshold"
                    type="number"
                    step={0.05}
                    min={0}
                    max={1}
                    value={settings.similarityThreshold}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, similarityThreshold: parseFloat(e.target.value) || 0.75 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Minimum similarity score (0-1) for grouping items
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="timeWindowHours">Time Window (Hours)</Label>
                  <Input
                    id="timeWindowHours"
                    type="number"
                    min={1}
                    max={168}
                    value={settings.timeWindowHours}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, timeWindowHours: parseInt(e.target.value) || 48 }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Hours to look back for related items (1-168)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Feature Flags */}
        {activeTab === 'features' && (
          <Card>
            <CardHeader>
              <CardTitle>Feature Flags</CardTitle>
              <CardDescription>
                Enable or disable system features
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Hacker News Ingestion</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically ingest from Hacker News
                  </p>
                </div>
                <Switch
                  checked={settings.enableHNIngestion}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({ ...s, enableHNIngestion: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Reddit Ingestion</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically ingest from Reddit
                  </p>
                </div>
                <Switch
                  checked={settings.enableRedditIngestion}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({ ...s, enableRedditIngestion: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Auto Clustering</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically cluster new items into stories
                  </p>
                </div>
                <Switch
                  checked={settings.enableAutoClustering}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({ ...s, enableAutoClustering: checked }))
                  }
                />
              </div>
              <div className="flex items-center justify-between">
                <div className="space-y-0.5">
                  <Label>Thumbnail Refresh</Label>
                  <p className="text-xs text-muted-foreground">
                    Automatically refresh story thumbnails
                  </p>
                </div>
                <Switch
                  checked={settings.enableThumbnailRefresh}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({ ...s, enableThumbnailRefresh: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}

        {/* Admin Settings */}
        {activeTab === 'admin' && (
          <Card>
            <CardHeader>
              <CardTitle>Admin Configuration</CardTitle>
              <CardDescription>
                Security and access control settings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="adminToken">Admin Token</Label>
                <Input
                  id="adminToken"
                  type="password"
                  placeholder="••••••••••••"
                  value={settings.adminToken}
                  onChange={(e) =>
                    setSettings((s) => ({ ...s, adminToken: e.target.value }))
                  }
                />
                <p className="text-xs text-muted-foreground">
                  Bearer token for admin API access (leave blank to keep current)
                </p>
              </div>
              <div className="flex items-center justify-between pt-4">
                <div className="space-y-0.5">
                  <Label>Require Approval</Label>
                  <p className="text-xs text-muted-foreground">
                    New stories require admin approval before publishing
                  </p>
                </div>
                <Switch
                  checked={settings.requireApproval}
                  onCheckedChange={(checked) =>
                    setSettings((s) => ({ ...s, requireApproval: checked }))
                  }
                />
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Info Card */}
      <Card className="bg-muted/50">
        <CardHeader>
          <CardTitle className="text-sm">Settings Persistence</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Settings are currently stored in memory and will reset on page refresh. 
            Full persistence requires:
          </p>
          <ul className="text-sm text-muted-foreground list-disc list-inside mt-2 space-y-1">
            <li>Settings table in database</li>
            <li>Backend API endpoints (GET /admin/settings, PATCH /admin/settings)</li>
            <li>Settings synchronization with worker processes</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
