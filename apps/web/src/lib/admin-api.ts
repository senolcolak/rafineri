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
        'Content-Type': 'application/json',
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

  // Workflows
  listWorkflows: () =>
    api.get<Array<{ id: string; name: string; description: string; enabled: boolean; nodes: number }>>('/v1/admin/approval/workflows'),

  createWorkflow: (data: { name: string; description: string; nodes: unknown[]; connections: unknown[]; trigger: unknown }) =>
    api.post<{ workflowId: string; name: string; status: string }>('/v1/admin/approval/workflows', data),

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
    api.get<{ settings: Record<string, unknown>; note?: string }>('/v1/admin/settings'),
  
  updateSettings: (settings: object) =>
    api.patch<{ message: string; settings: object }>('/v1/admin/settings', settings),
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
