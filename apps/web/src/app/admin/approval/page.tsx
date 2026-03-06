'use client';

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Play, RefreshCw, CheckCircle2, XCircle, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { adminApi } from '@/lib/admin-api';

interface ApprovalListItem {
  id: string;
  storyId: string;
  status: string;
  priority: number;
  finalConfidence: number | null;
  finalReason: string | null;
  createdAt: string;
  updatedAt: string;
  completedAt: string | null;
}

interface ApprovalDetail {
  id: string;
  storyId: string;
  status: string;
  finalConfidence: number | null;
  finalReason: string | null;
  steps: Array<{
    id: string;
    stepType: string;
    status: string;
    startedAt: string | null;
    completedAt: string | null;
    durationMs: number | null;
  }>;
  decisions: Array<{
    id: string;
    decision: string;
    reason: string;
    confidence: number;
    source: string;
    createdAt: string;
  }>;
}

interface Validator {
  name: string;
  enabled: boolean;
  weight: number;
}

export default function ApprovalPage() {
  const [activeTab, setActiveTab] = useState('requests');
  const [statusFilter, setStatusFilter] = useState('all');
  const [requests, setRequests] = useState<ApprovalListItem[]>([]);
  const [selectedRequestId, setSelectedRequestId] = useState<string | null>(null);
  const [requestDetail, setRequestDetail] = useState<ApprovalDetail | null>(null);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [requestActionLoading, setRequestActionLoading] = useState<string | null>(null);
  const [validators, setValidators] = useState<Validator[]>([]);
  const [crossCheckResult, setCrossCheckResult] = useState<Record<string, unknown> | null>(null);
  const [crossCheckLoading, setCrossCheckLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [submitData, setSubmitData] = useState({
    storyId: '',
    title: '',
    claim: '',
    content: '',
    sources: '',
  });
  const [manualDecision, setManualDecision] = useState({
    decision: 'approved' as 'approved' | 'rejected',
    reason: '',
    confidence: 0.7,
  });
  const [crossCheckInput, setCrossCheckInput] = useState({
    claim: '',
    context: '',
    keywords: '',
  });

  useEffect(() => {
    void loadValidators();
    void loadRequests();
    const interval = setInterval(() => {
      void loadRequests();
      if (selectedRequestId) {
        void loadRequestDetail(selectedRequestId);
      }
    }, 5000);
    return () => clearInterval(interval);
  }, [selectedRequestId]);

  const selectedRequest = useMemo(
    () => requests.find((item) => item.id === selectedRequestId) || null,
    [requests, selectedRequestId],
  );

  async function loadValidators() {
    try {
      const data = await adminApi.getValidators();
      setValidators(data);
    } catch (e) {
      setError('Failed to load validators');
    }
  }

  async function loadRequests() {
    setLoadingRequests(true);
    try {
      const data = await adminApi.listApprovalRequests({
        status: statusFilter === 'all' ? undefined : statusFilter,
        page: 1,
        limit: 50,
      });
      setRequests(data.items);
    } catch (e) {
      setError('Failed to load approval requests');
    } finally {
      setLoadingRequests(false);
    }
  }

  async function loadRequestDetail(id: string) {
    setLoadingDetail(true);
    try {
      const detail = await adminApi.getApprovalRequest(id);
      setRequestDetail(detail);
    } catch (e) {
      setError('Failed to load request detail');
    } finally {
      setLoadingDetail(false);
    }
  }

  async function submitRequest() {
    if (!submitData.storyId || !submitData.claim) {
      return;
    }
    setError(null);
    setMessage(null);
    try {
      const response = await adminApi.createApprovalRequest({
        storyId: submitData.storyId,
        title: submitData.title || undefined,
        claim: submitData.claim,
        content: submitData.content || undefined,
        sources: submitData.sources.split(',').map((s) => s.trim()).filter(Boolean),
      });
      setMessage(`Request ${response.requestId} queued`);
      setSubmitData({ storyId: '', title: '', claim: '', content: '', sources: '' });
      await loadRequests();
      setSelectedRequestId(response.requestId);
      await loadRequestDetail(response.requestId);
      setActiveTab('requests');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to submit request');
    }
  }

  async function runCrossCheck() {
    if (!crossCheckInput.claim.trim()) {
      return;
    }
    setCrossCheckLoading(true);
    setError(null);
    try {
      const keywords = crossCheckInput.keywords
        .split(',')
        .map((value) => value.trim())
        .filter(Boolean);
      const data = await adminApi.runCrossCheck({
        claim: crossCheckInput.claim,
        context: crossCheckInput.context || undefined,
        keywords: keywords.length > 0 ? keywords : undefined,
      });
      setCrossCheckResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cross-check failed');
    } finally {
      setCrossCheckLoading(false);
    }
  }

  async function retryRequest(id: string) {
    setRequestActionLoading(id);
    try {
      await adminApi.retryApprovalRequest(id);
      setMessage(`Request ${id} queued for retry`);
      await loadRequests();
      await loadRequestDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Retry failed');
    } finally {
      setRequestActionLoading(null);
    }
  }

  async function cancelRequest(id: string) {
    setRequestActionLoading(id);
    try {
      await adminApi.cancelApprovalRequest(id);
      setMessage(`Request ${id} cancelled`);
      await loadRequests();
      await loadRequestDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    } finally {
      setRequestActionLoading(null);
    }
  }

  async function applyManualDecision(id: string) {
    setRequestActionLoading(id);
    try {
      await adminApi.manualApprovalDecision(id, manualDecision);
      setMessage(`Manual decision saved for request ${id}`);
      setManualDecision({ decision: 'approved', reason: '', confidence: 0.7 });
      await loadRequests();
      await loadRequestDetail(id);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Manual decision failed');
    } finally {
      setRequestActionLoading(null);
    }
  }

  function statusBadge(status: string) {
    switch (status) {
      case 'approved':
        return <Badge className="bg-green-500">approved</Badge>;
      case 'rejected':
        return <Badge className="bg-red-500">rejected</Badge>;
      case 'awaiting_manual_review':
        return <Badge className="bg-yellow-500 text-black">manual review</Badge>;
      case 'processing':
        return <Badge className="bg-blue-500">processing</Badge>;
      case 'queued':
        return <Badge variant="secondary">queued</Badge>;
      case 'failed':
        return <Badge variant="destructive">failed</Badge>;
      case 'cancelled':
        return <Badge variant="outline">cancelled</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Approval Workflow</h1>
          <p className="text-muted-foreground">Queue, monitor, and manually finalize approval decisions</p>
        </div>
        <Button variant="outline" onClick={() => loadRequests()}>
          <RefreshCw className="mr-2 h-4 w-4" />
          Refresh
        </Button>
      </div>

      {message && <div className="rounded-md border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}
      {error && <div className="rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="requests">Requests</TabsTrigger>
          <TabsTrigger value="submit">Submit</TabsTrigger>
          <TabsTrigger value="cross-check">Cross-Check</TabsTrigger>
          <TabsTrigger value="validators">Validators</TabsTrigger>
        </TabsList>

        <TabsContent value="requests" className="space-y-4">
          <div className="grid gap-4 lg:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Approval Requests</CardTitle>
                <CardDescription>Asynchronous workflow queue</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex gap-2">
                  <select
                    className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                  >
                    <option value="all">All statuses</option>
                    <option value="queued">Queued</option>
                    <option value="processing">Processing</option>
                    <option value="awaiting_manual_review">Awaiting manual review</option>
                    <option value="approved">Approved</option>
                    <option value="rejected">Rejected</option>
                    <option value="failed">Failed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <Button variant="outline" onClick={() => loadRequests()}>
                    Apply
                  </Button>
                </div>

                {loadingRequests ? (
                  <div className="flex items-center justify-center p-8">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                ) : requests.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No approval requests found.</p>
                ) : (
                  <div className="max-h-[520px] space-y-2 overflow-y-auto">
                    {requests.map((item) => (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          setSelectedRequestId(item.id);
                          void loadRequestDetail(item.id);
                        }}
                        className={`w-full rounded-md border p-3 text-left ${selectedRequestId === item.id ? 'border-primary' : ''}`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-medium">#{item.id} / Story {item.storyId}</span>
                          {statusBadge(item.status)}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          Updated {new Date(item.updatedAt).toLocaleString()}
                        </div>
                        {item.finalReason && <div className="mt-1 text-xs">{item.finalReason}</div>}
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Request Detail</CardTitle>
                <CardDescription>State machine timeline and decisions</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {!selectedRequest && <p className="text-sm text-muted-foreground">Select a request to inspect.</p>}
                {selectedRequest && loadingDetail && (
                  <div className="flex items-center justify-center p-6">
                    <Loader2 className="h-5 w-5 animate-spin" />
                  </div>
                )}
                {selectedRequest && requestDetail && (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="font-medium">Request #{requestDetail.id}</div>
                      {statusBadge(requestDetail.status)}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      Story {requestDetail.storyId} · Confidence {Math.round((requestDetail.finalConfidence || 0) * 100)}%
                    </div>
                    {requestDetail.finalReason && (
                      <div className="rounded-md border p-2 text-sm">{requestDetail.finalReason}</div>
                    )}

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Steps</div>
                      {requestDetail.steps.map((step) => (
                        <div key={step.id} className="rounded-md border p-2 text-sm">
                          <div className="flex items-center justify-between">
                            <span>{step.stepType}</span>
                            {statusBadge(step.status)}
                          </div>
                          <div className="text-xs text-muted-foreground">
                            {step.startedAt ? new Date(step.startedAt).toLocaleString() : '-'} · {step.durationMs ?? 0}ms
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="space-y-2">
                      <div className="text-sm font-medium">Decisions</div>
                      {requestDetail.decisions.length === 0 ? (
                        <p className="text-sm text-muted-foreground">No decisions yet.</p>
                      ) : (
                        requestDetail.decisions.map((decision) => (
                          <div key={decision.id} className="rounded-md border p-2 text-sm">
                            <div className="flex items-center justify-between">
                              <span>{decision.decision}</span>
                              <Badge variant="outline">{decision.source}</Badge>
                            </div>
                            <div className="text-xs">{decision.reason}</div>
                          </div>
                        ))
                      )}
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <Button
                        variant="outline"
                        disabled={requestActionLoading === requestDetail.id}
                        onClick={() => retryRequest(requestDetail.id)}
                      >
                        {requestActionLoading === requestDetail.id ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        Retry
                      </Button>
                      <Button
                        variant="outline"
                        disabled={requestActionLoading === requestDetail.id}
                        onClick={() => cancelRequest(requestDetail.id)}
                      >
                        Cancel
                      </Button>
                    </div>

                    <div className="space-y-2 rounded-md border p-3">
                      <div className="text-sm font-medium">Manual Decision</div>
                      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
                        <select
                          className="h-9 rounded-md border border-input bg-background px-3 text-sm"
                          value={manualDecision.decision}
                          onChange={(e) => setManualDecision((prev) => ({ ...prev, decision: e.target.value as 'approved' | 'rejected' }))}
                        >
                          <option value="approved">Approve</option>
                          <option value="rejected">Reject</option>
                        </select>
                        <Input
                          type="number"
                          min="0"
                          max="1"
                          step="0.05"
                          value={manualDecision.confidence}
                          onChange={(e) => setManualDecision((prev) => ({ ...prev, confidence: Number(e.target.value) }))}
                        />
                        <Button
                          disabled={requestActionLoading === requestDetail.id || !manualDecision.reason.trim()}
                          onClick={() => applyManualDecision(requestDetail.id)}
                        >
                          Save Decision
                        </Button>
                      </div>
                      <Textarea
                        rows={2}
                        placeholder="Reason for manual decision"
                        value={manualDecision.reason}
                        onChange={(e) => setManualDecision((prev) => ({ ...prev, reason: e.target.value }))}
                      />
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="submit">
          <Card>
            <CardHeader>
              <CardTitle>Submit Approval Request</CardTitle>
              <CardDescription>Create durable, asynchronous approval jobs</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Story ID</Label>
                  <Input value={submitData.storyId} onChange={(e) => setSubmitData((prev) => ({ ...prev, storyId: e.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label>Title (optional)</Label>
                  <Input value={submitData.title} onChange={(e) => setSubmitData((prev) => ({ ...prev, title: e.target.value }))} />
                </div>
              </div>
              <div className="space-y-2">
                <Label>Claim</Label>
                <Textarea rows={3} value={submitData.claim} onChange={(e) => setSubmitData((prev) => ({ ...prev, claim: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Context (optional)</Label>
                <Textarea rows={2} value={submitData.content} onChange={(e) => setSubmitData((prev) => ({ ...prev, content: e.target.value }))} />
              </div>
              <div className="space-y-2">
                <Label>Sources (comma-separated, optional)</Label>
                <Input value={submitData.sources} onChange={(e) => setSubmitData((prev) => ({ ...prev, sources: e.target.value }))} />
              </div>
              <Button onClick={submitRequest} disabled={!submitData.storyId || !submitData.claim}>
                <Play className="mr-2 h-4 w-4" />
                Queue Request
              </Button>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cross-check">
          <Card>
            <CardHeader>
              <CardTitle>Cross-Check Validation</CardTitle>
              <CardDescription>Run validator-only checks without creating approval requests</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label>Claim</Label>
                <Textarea
                  rows={3}
                  value={crossCheckInput.claim}
                  onChange={(e) => setCrossCheckInput((prev) => ({ ...prev, claim: e.target.value }))}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-2">
                  <Label>Context (optional)</Label>
                  <Input
                    value={crossCheckInput.context}
                    onChange={(e) => setCrossCheckInput((prev) => ({ ...prev, context: e.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label>Keywords (comma-separated)</Label>
                  <Input
                    value={crossCheckInput.keywords}
                    onChange={(e) => setCrossCheckInput((prev) => ({ ...prev, keywords: e.target.value }))}
                  />
                </div>
              </div>
              <Button disabled={crossCheckLoading || !crossCheckInput.claim.trim()} onClick={runCrossCheck}>
                {crossCheckLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Run Cross-Check
              </Button>
              {crossCheckResult && (
                <pre className="max-h-[360px] overflow-auto rounded-md border bg-muted p-3 text-xs">
                  {JSON.stringify(crossCheckResult, null, 2)}
                </pre>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="validators">
          <Card>
            <CardHeader>
              <CardTitle>Validators</CardTitle>
              <CardDescription>Currently configured cross-check validators</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {validators.length === 0 ? (
                <p className="text-sm text-muted-foreground">No validator metadata found.</p>
              ) : (
                validators.map((validator) => (
                  <div key={validator.name} className="flex items-center justify-between rounded-md border p-3">
                    <div>
                      <div className="font-medium">{validator.name}</div>
                      <div className="text-xs text-muted-foreground">Weight: {validator.weight}</div>
                    </div>
                    {validator.enabled ? (
                      <Badge className="bg-green-500">
                        <CheckCircle2 className="mr-1 h-3 w-3" />
                        enabled
                      </Badge>
                    ) : (
                      <Badge variant="secondary">
                        <XCircle className="mr-1 h-3 w-3" />
                        disabled
                      </Badge>
                    )}
                  </div>
                ))
              )}
              <div className="mt-2 flex items-center gap-2 text-xs text-muted-foreground">
                <AlertCircle className="h-3 w-3" />
                Validator toggling is controlled by server configuration.
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
