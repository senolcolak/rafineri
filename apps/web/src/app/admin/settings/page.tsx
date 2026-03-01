'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Save } from 'lucide-react';

export default function AdminSettingsPage() {
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState('ingestion');
  const [settings, setSettings] = useState({
    // Ingestion Settings
    hnConcurrency: 5,
    hnBatchSize: 30,
    redditLimit: 25,
    
    // Clustering Settings
    similarityThreshold: 0.75,
    timeWindowHours: 48,
    
    // Feature Flags
    enableHNIngestion: true,
    enableRedditIngestion: true,
    enableAutoClustering: true,
    enableThumbnailRefresh: true,
    
    // Admin Settings
    adminToken: '',
    requireApproval: false,
  });

  async function handleSave() {
    setSaving(true);
    await new Promise((resolve) => setTimeout(resolve, 1000));
    setSaving(false);
  }

  const tabs = [
    { id: 'ingestion', label: 'Ingestion' },
    { id: 'clustering', label: 'Clustering' },
    { id: 'features', label: 'Features' },
    { id: 'admin', label: 'Admin' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Settings</h1>
          <p className="text-muted-foreground">
            Configure system behavior and features
          </p>
        </div>
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? 'Saving...' : 'Save Changes'}
        </Button>
      </div>

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
                      value={settings.hnConcurrency}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, hnConcurrency: parseInt(e.target.value) }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Number of concurrent requests
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="hnBatchSize">Batch Size</Label>
                    <Input
                      id="hnBatchSize"
                      type="number"
                      value={settings.hnBatchSize}
                      onChange={(e) =>
                        setSettings((s) => ({ ...s, hnBatchSize: parseInt(e.target.value) }))
                      }
                    />
                    <p className="text-xs text-muted-foreground">
                      Items to fetch per batch
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
                    value={settings.redditLimit}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, redditLimit: parseInt(e.target.value) }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Maximum posts to fetch per subreddit
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
                    step="0.05"
                    min="0"
                    max="1"
                    value={settings.similarityThreshold}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, similarityThreshold: parseFloat(e.target.value) }))
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
                    value={settings.timeWindowHours}
                    onChange={(e) =>
                      setSettings((s) => ({ ...s, timeWindowHours: parseInt(e.target.value) }))
                    }
                  />
                  <p className="text-xs text-muted-foreground">
                    Hours to look back for related items
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
                  Bearer token for admin API access
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
    </div>
  );
}
