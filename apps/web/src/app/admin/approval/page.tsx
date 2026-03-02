'use client';

import { useState, useEffect } from 'react';
import { CheckSquare, Loader2, Play, Plus, Trash2, AlertCircle, CheckCircle, XCircle, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { adminApi } from '@/lib/admin-api';

interface Validator {
  name: string;
  enabled: boolean;
  weight: number;
  description: string;
}

interface CrossCheckResult {
  source: string;
  status: string;
  confidence: number;
  evidence: unknown[];
}

interface CrossCheckResponse {
  overallStatus: string;
  confidence: number;
  sourcesChecked: string[];
  results: CrossCheckResult[];
  consensus: string;
}

interface HttpRule {
  id: string;
  config: {
    name: string;
    url: string;
    method: 'GET' | 'POST';
    headers?: Record<string, string>;
    body?: unknown;
    queryParams?: Record<string, string>;
    extractPath?: string;
    matchPattern?: string;
    timeoutMs?: number;
  };
  validationLogic: 'contains' | 'equals' | 'exists' | 'regex';
  expectedValue?: string;
  weight: number;
}

export default function ApprovalPage() {
  const [activeTab, setActiveTab] = useState('cross-check');
  const [validators, setValidators] = useState<Validator[]>([]);
  const [loading, setLoading] = useState(false);
  const [validatorsLoading, setValidatorsLoading] = useState(true);
  
  // Cross-check form state
  const [claim, setClaim] = useState('');
  const [context, setContext] = useState('');
  const [keywords, setKeywords] = useState('');
  const [crossCheckResult, setCrossCheckResult] = useState<CrossCheckResponse | null>(null);
  const [crossCheckError, setCrossCheckError] = useState('');
  
  // Approval form state
  const [approvalStoryId, setApprovalStoryId] = useState('');
  const [approvalTitle, setApprovalTitle] = useState('');
  const [approvalClaim, setApprovalClaim] = useState('');
  const [approvalSources, setApprovalSources] = useState('');
  const [approvalResult, setApprovalResult] = useState<unknown>(null);
  const [approvalLoading, setApprovalLoading] = useState(false);
  
  // HTTP Rules state
  const [httpRules, setHttpRules] = useState<HttpRule[]>([]);

  useEffect(() => {
    loadValidators();
  }, []);

  const loadValidators = async () => {
    try {
      const response = await adminApi.getValidators();
      setValidators(response.data);
    } catch (error) {
      console.error('Failed to load validators:', error);
    } finally {
      setValidatorsLoading(false);
    }
  };

  const handleCrossCheck = async () => {
    if (!claim.trim()) return;
    
    setLoading(true);
    setCrossCheckError('');
    setCrossCheckResult(null);
    
    try {
      const keywordsArray = keywords.split(',').map(k => k.trim()).filter(Boolean);
      const response = await adminApi.runCrossCheck({
        claim,
        context: context || undefined,
        keywords: keywordsArray.length > 0 ? keywordsArray : undefined,
      });
      setCrossCheckResult(response.data);
    } catch (error) {
      setCrossCheckError(error instanceof Error ? error.message : 'Cross-check failed');
    } finally {
      setLoading(false);
    }
  };

  const handleApproval = async () => {
    if (!approvalStoryId.trim() || !approvalTitle.trim() || !approvalClaim.trim()) return;
    
    setApprovalLoading(true);
    setApprovalResult(null);
    
    try {
      const sourcesArray = approvalSources.split(',').map(s => s.trim()).filter(Boolean);
      const response = await adminApi.processApproval({
        storyId: approvalStoryId,
        title: approvalTitle,
        claim: approvalClaim,
        sources: sourcesArray.length > 0 ? sourcesArray : undefined,
      });
      setApprovalResult(response.data);
    } catch (error) {
      setApprovalResult({ error: error instanceof Error ? error.message : 'Approval failed' });
    } finally {
      setApprovalLoading(false);
    }
  };

  const addHttpRule = () => {
    const newRule: HttpRule = {
      id: `rule-${Date.now()}`,
      config: {
        name: 'New Rule',
        url: '',
        method: 'GET',
      },
      validationLogic: 'contains',
      expectedValue: '',
      weight: 0.5,
    };
    setHttpRules([...httpRules, newRule]);
  };

  const removeHttpRule = (id: string) => {
    setHttpRules(httpRules.filter(r => r.id !== id));
  };

  const updateHttpRule = (id: string, updates: Partial<HttpRule>) => {
    setHttpRules(httpRules.map(r => r.id === id ? { ...r, ...updates } : r));
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'verified':
        return <CheckCircle className="h-5 w-5 text-green-500" />;
      case 'unverified':
        return <XCircle className="h-5 w-5 text-red-500" />;
      case 'disputed':
        return <AlertCircle className="h-5 w-5 text-yellow-500" />;
      default:
        return <AlertCircle className="h-5 w-5 text-gray-500" />;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'verified':
        return <Badge className="bg-green-500">Verified</Badge>;
      case 'unverified':
        return <Badge className="bg-red-500">Unverified</Badge>;
      case 'disputed':
        return <Badge className="bg-yellow-500">Disputed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Cross-Check & Approval</h1>
        <p className="text-muted-foreground">
          Verify claims using multiple validators and run approval workflows
        </p>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="cross-check">Cross-Check</TabsTrigger>
          <TabsTrigger value="approval">Approval Workflow</TabsTrigger>
          <TabsTrigger value="validators">Validators</TabsTrigger>
          <TabsTrigger value="http-rules">HTTP Rules</TabsTrigger>
        </TabsList>

        {/* Cross-Check Tab */}
        <TabsContent value="cross-check" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Run Cross-Check</CardTitle>
              <CardDescription>
                Verify a claim against multiple external sources
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="claim">Claim to Verify</Label>
                <Textarea
                  id="claim"
                  placeholder="Enter the claim you want to verify..."
                  value={claim}
                  onChange={(e) => setClaim(e.target.value)}
                  rows={3}
                />
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="context">Context (Optional)</Label>
                  <Input
                    id="context"
                    placeholder="Additional context"
                    value={context}
                    onChange={(e) => setContext(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="keywords">Keywords (comma-separated)</Label>
                  <Input
                    id="keywords"
                    placeholder="keyword1, keyword2, keyword3"
                    value={keywords}
                    onChange={(e) => setKeywords(e.target.value)}
                  />
                </div>
              </div>

              <Button onClick={handleCrossCheck} disabled={loading || !claim.trim()}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Cross-Check...
                  </>
                ) : (
                  <>
                    <Play className="mr-2 h-4 w-4" />
                    Run Cross-Check
                  </>
                )}
              </Button>

              {crossCheckError && (
                <div className="p-3 text-sm text-red-500 bg-red-5 rounded-md">
                  {crossCheckError}
                </div>
              )}

              {crossCheckResult && (
                <div className="space-y-4 mt-6">
                  <div className="flex items-center justify-between p-4 bg-muted rounded-lg">
                    <div className="flex items-center gap-3">
                      {getStatusIcon(crossCheckResult.overallStatus)}
                      <div>
                        <p className="font-medium">Overall Status: {crossCheckResult.overallStatus}</p>
                        <p className="text-sm text-muted-foreground">
                          Confidence: {Math.round(crossCheckResult.confidence * 100)}%
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-muted-foreground">
                        Sources Checked: {crossCheckResult.sourcesChecked?.length ?? 0}
                      </p>
                      <p className="text-sm">{crossCheckResult.consensus}</p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <h4 className="font-medium">Validator Results</h4>
                    {(crossCheckResult.results ?? []).map((result, index) => (
                      <div key={index} className="flex items-center justify-between p-3 border rounded-lg">
                        <div className="flex items-center gap-3">
                          {getStatusIcon(result.status)}
                          <div>
                            <p className="font-medium capitalize">{result.source.replace('-', ' ')}</p>
                            <p className="text-sm text-muted-foreground">
                              Confidence: {Math.round(result.confidence * 100)}%
                            </p>
                          </div>
                        </div>
                        {getStatusBadge(result.status)}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Approval Workflow Tab */}
        <TabsContent value="approval" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Process Approval</CardTitle>
              <CardDescription>
                Submit a story through the full approval workflow
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="approval-story-id">Story ID</Label>
                  <Input
                    id="approval-story-id"
                    placeholder="story-123"
                    value={approvalStoryId}
                    onChange={(e) => setApprovalStoryId(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="approval-title">Title</Label>
                  <Input
                    id="approval-title"
                    placeholder="Story title"
                    value={approvalTitle}
                    onChange={(e) => setApprovalTitle(e.target.value)}
                  />
                </div>
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="approval-claim">Claim</Label>
                <Textarea
                  id="approval-claim"
                  placeholder="The main claim to verify..."
                  value={approvalClaim}
                  onChange={(e) => setApprovalClaim(e.target.value)}
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="approval-sources">Sources (comma-separated URLs)</Label>
                <Input
                  id="approval-sources"
                  placeholder="https://source1.com, https://source2.com"
                  value={approvalSources}
                  onChange={(e) => setApprovalSources(e.target.value)}
                />
              </div>

              <Button 
                onClick={handleApproval} 
                disabled={approvalLoading || !approvalStoryId.trim() || !approvalTitle.trim() || !approvalClaim.trim()}
              >
                {approvalLoading ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <CheckSquare className="mr-2 h-4 w-4" />
                    Process Approval
                  </>
                )}
              </Button>

              {approvalResult !== null && (
                <div className="mt-6 p-4 bg-muted rounded-lg">
                  {typeof approvalResult === 'object' && 'approved' in approvalResult ? (
                    <div className="space-y-2">
                      {(() => {
                        const result = approvalResult as { approved: boolean; status: string; reason: string; confidence: number };
                        return (
                          <>
                            <div className="flex items-center gap-2">
                              {result.approved ? (
                                <CheckCircle className="h-5 w-5 text-green-500" />
                              ) : (
                                <XCircle className="h-5 w-5 text-red-500" />
                              )}
                              <span className="font-medium">
                                Status: {String(result.status)}
                              </span>
                            </div>
                            <p className="text-sm">Reason: {String(result.reason)}</p>
                            <p className="text-sm">Confidence: {Math.round(Number(result.confidence) * 100)}%</p>
                          </>
                        );
                      })()}
                    </div>
                  ) : (
                    <p className="text-red-500">{(approvalResult as { error?: string }).error || 'Processing failed'}</p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Validators Tab */}
        <TabsContent value="validators" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Available Validators</CardTitle>
              <CardDescription>
                Configure which validators are used for cross-check verification
              </CardDescription>
            </CardHeader>
            <CardContent>
              {validatorsLoading ? (
                <div className="flex items-center justify-center p-8">
                  <Loader2 className="h-6 w-6 animate-spin" />
                </div>
              ) : (
                <div className="space-y-3">
                  {validators.map((validator) => (
                    <div key={validator.name} className="flex items-center justify-between p-3 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <Settings className="h-4 w-4 text-muted-foreground" />
                        <div>
                          <p className="font-medium capitalize">{validator.name.replace('-', ' ')}</p>
                          <p className="text-sm text-muted-foreground">{validator.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-3">
                        <Badge variant="outline">Weight: {validator.weight}</Badge>
                        {validator.enabled ? (
                          <Badge className="bg-green-500">Enabled</Badge>
                        ) : (
                          <Badge variant="secondary">Disabled</Badge>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* HTTP Rules Tab */}
        <TabsContent value="http-rules" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Custom HTTP Validation Rules</CardTitle>
              <CardDescription>
                Add custom HTTP endpoints to validate claims
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button onClick={addHttpRule}>
                <Plus className="mr-2 h-4 w-4" />
                Add HTTP Rule
              </Button>

              {httpRules.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center p-8">
                  No custom HTTP rules configured. Click &quot;Add HTTP Rule&quot; to create one.
                </p>
              ) : (
                <div className="space-y-4">
                  {httpRules.map((rule) => (
                    <div key={rule.id} className="p-4 border rounded-lg space-y-4">
                      <div className="flex items-center justify-between">
                        <Input
                          placeholder="Rule name"
                          value={rule.config.name}
                          onChange={(e) => updateHttpRule(rule.id, {
                            config: { ...rule.config, name: e.target.value }
                          })}
                          className="max-w-xs"
                        />
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removeHttpRule(rule.id)}
                        >
                          <Trash2 className="h-4 w-4 text-red-500" />
                        </Button>
                      </div>
                      
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Method</Label>
                          <Select
                            value={rule.config.method}
                            onValueChange={(value) => 
                              updateHttpRule(rule.id, { config: { ...rule.config, method: value as 'GET' | 'POST' } })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="GET">GET</SelectItem>
                              <SelectItem value="POST">POST</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2 md:col-span-2">
                          <Label>URL</Label>
                          <Input
                            placeholder="https://api.example.com/verify"
                            value={rule.config.url}
                            onChange={(e) => updateHttpRule(rule.id, {
                              config: { ...rule.config, url: e.target.value }
                            })}
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="space-y-2">
                          <Label>Validation Logic</Label>
                          <Select
                            value={rule.validationLogic}
                            onValueChange={(value) => 
                              updateHttpRule(rule.id, { validationLogic: value as HttpRule['validationLogic'] })
                            }
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="contains">Contains</SelectItem>
                              <SelectItem value="equals">Equals</SelectItem>
                              <SelectItem value="exists">Exists</SelectItem>
                              <SelectItem value="regex">Regex</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label>Expected Value</Label>
                          <Input
                            placeholder="expected value"
                            value={rule.expectedValue || ''}
                            onChange={(e) => updateHttpRule(rule.id, { expectedValue: e.target.value })}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label>Weight (0-1)</Label>
                          <Input
                            type="number"
                            min="0"
                            max="1"
                            step="0.1"
                            value={rule.weight}
                            onChange={(e) => updateHttpRule(rule.id, { weight: parseFloat(e.target.value) })}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
