import type { Story, PaginatedStories } from '@rafineri/shared';

// Use relative path so Next.js rewrites handle the proxying
const API_BASE_URL = '/api';
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || '15000', 10) || 15000;

class AdminApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'AdminApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new AdminApiError(
      errorData.message || `HTTP error! status: ${response.status}`,
      response.status,
      errorData
    );
  }
  const data = await response.json();
  // Unwrap the response if it has the standard API wrapper format
  if (data && typeof data === 'object' && 'data' in data && 'success' in data) {
    return data.data as T;
  }
  return data as T;
}

function getAdminToken(): string {
  if (typeof document === 'undefined') return '';
  const matches = document.cookie.match(/admin_token=([^;]+)/);
  return matches ? matches[1] : '';
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const token = getAdminToken();
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      headers: {
        'Accept': 'application/json',
        'x-admin-token': token,
      },
      credentials: 'include',
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const token = getAdminToken();
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-admin-token': token,
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const token = getAdminToken();
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'x-admin-token': token,
      },
      body: JSON.stringify(body),
      credentials: 'include',
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const token = getAdminToken();
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'x-admin-token': token,
      },
      credentials: 'include',
    });
    return handleResponse<T>(response);
  },
};

// Admin-specific API functions
export const adminApi = {
  // Auth
  login: async (username: string, password: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/v1/admin/auth/login`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({ username, password }),
      credentials: 'include',
    });
    return handleResponse<{ token: string; expiresIn: number }>(response);
  },

  logout: async () => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/v1/admin/auth/logout`, {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
      },
      credentials: 'include',
    });
    return handleResponse<{ message: string }>(response);
  },

  verify: async (token: string) => {
    const response = await fetchWithTimeout(`${API_BASE_URL}/v1/admin/auth/verify`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
        'x-admin-token': token,
      },
      credentials: 'include',
    });
    return handleResponse<{ valid: boolean }>(response);
  },

  // Approval
  submitForApproval: (data: { storyId: string; title: string; claim: string; sources?: string[] }) =>
    api.post<{ requestId: string; status: string }>('/v1/admin/approval/submit', data),

  processApproval: (data: { storyId: string; title: string; claim: string; sources?: string[] }) =>
    api.post<{ storyId: string; approved: boolean; confidence: number; status: string; reason: string }>('/v1/admin/approval/process', data),

  createApprovalRequest: (data: {
    storyId: string;
    title?: string;
    content?: string;
    claim: string;
    sources?: string[];
    idempotencyKey?: string;
  }) => api.post<{ requestId: string; status: string; message: string }>('/v1/admin/approval/requests', data),

  listApprovalRequests: (params?: {
    status?: string;
    page?: number;
    limit?: number;
  }) => {
    const searchParams = new URLSearchParams();
    if (params?.status) searchParams.set('status', params.status);
    if (params?.page) searchParams.set('page', String(params.page));
    if (params?.limit) searchParams.set('limit', String(params.limit));
    const query = searchParams.toString();
    return api.get<{ items: Array<{
      id: string;
      storyId: string;
      status: string;
      priority: number;
      finalConfidence: number | null;
      finalReason: string | null;
      createdAt: string;
      updatedAt: string;
      completedAt: string | null;
    }>; page: number; limit: number }>(`/v1/admin/approval/requests${query ? `?${query}` : ''}`);
  },

  getApprovalRequest: (id: string) =>
    api.get<{
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
    }>(`/v1/admin/approval/requests/${id}`),

  retryApprovalRequest: (id: string) =>
    api.post<{ id: string; status: string; message: string }>(`/v1/admin/approval/requests/${id}/retry`, {}),

  cancelApprovalRequest: (id: string) =>
    api.post<{ id: string; status: string; message: string }>(`/v1/admin/approval/requests/${id}/cancel`, {}),

  manualApprovalDecision: (id: string, data: { decision: 'approved' | 'rejected'; reason: string; confidence: number }) =>
    api.post<{ id: string; status: string; message: string }>(`/v1/admin/approval/requests/${id}/manual-decision`, data),

  runCrossCheck: (data: { claim: string; context?: string; keywords?: string[] }) =>
    api.post<{
      overallStatus: string;
      confidence: number;
      sourcesChecked: string[];
      results: Array<{ source: string; status: string; confidence: number; evidence: unknown[] }>;
      consensus: string;
    }>('/v1/admin/approval/cross-check', data),

  getValidators: () =>
    api.get<Array<{ name: string; enabled: boolean; weight: number; description: string }>>('/v1/admin/approval/validators'),

  // HTTP Check
  testHttpCheck: (data: { config: unknown; validationLogic: string; expectedValue?: string; weight: number }) =>
    api.post<{ name: string; passed: boolean; responseTime: number }>('/v1/admin/approval/http-check', data),

  // Stories
  getStories: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedStories>(`/v1/admin/stories?${new URLSearchParams(params as Record<string, string>)}`),
  
  getStory: (id: string) =>
    api.get<Story>(`/v1/admin/stories/${id}`),
  
  updateStory: (id: string, data: Partial<Story>) =>
    api.patch<Story>(`/v1/admin/stories/${id}`, data),
  
  deleteStory: (id: string) =>
    api.delete<void>(`/v1/admin/stories/${id}`),
  
  // Sources
  getSources: () =>
    api.get<Array<{ id: string; name: string; type: string; isActive: boolean; itemsCount?: number; lastIngested?: string }>>('/v1/admin/sources'),
  
  updateSource: (id: string, data: { isActive: boolean }) =>
    api.patch(`/v1/admin/sources/${id}`, data),
  
  triggerIngestion: (sourceType: 'hackernews' | 'reddit') =>
    api.post<{ message: string; jobId: string; source: string }>(`/v1/admin/sources/trigger/${sourceType}`, {}),
  
  pauseAllSources: () =>
    api.post<{ message: string; count: number }>('/v1/admin/sources/pause-all', {}),
  
  resumeAllSources: () =>
    api.post<{ message: string; count: number }>('/v1/admin/sources/resume-all', {}),
  
  // System
  getHealth: () =>
    api.get<{ status: string; services: Record<string, string> }>('/v1/admin/health'),
  
  getLogs: (lines = 100) =>
    api.get<string[]>(`/v1/admin/logs?lines=${lines}`),
  
  getMetrics: () =>
    api.get<string>('/v1/admin/metrics'),
  
  // Settings
  getSettings: () =>
    api.get<{ settings: Record<string, unknown>; version: number; updatedAt: string | null }>('/v1/admin/settings'),
  
  updateSettings: (settings: object & { version?: number }) =>
    api.patch<{ success: boolean; message: string; settings: object; version: number }>('/v1/admin/settings', settings),

  // Users
  getUsers: () =>
    api.get<Array<{
      id: string;
      username: string;
      email: string;
      role: 'admin' | 'editor' | 'reviewer' | 'viewer';
      isActive: boolean;
      lastLoginAt: string | null;
      createdAt: string;
    }>>('/v1/admin/users'),

  createUser: (data: { username: string; email: string; password: string; role: 'admin' | 'editor' | 'reviewer' | 'viewer' }) =>
    api.post<{ id: string; username: string; email: string; role: string; isActive: boolean; createdAt: string }>('/v1/admin/users', data),

  updateUser: (id: string, data: { email?: string; password?: string; role?: 'admin' | 'editor' | 'reviewer' | 'viewer'; isActive?: boolean }) =>
    api.patch<{ id: string; message: string }>(`/v1/admin/users/${id}`, data),

  deleteUser: (id: string) =>
    api.delete<{ id: string; message: string }>(`/v1/admin/users/${id}`),
};

async function fetchWithTimeout(url: string, init: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new AdminApiError(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`, 504);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}
