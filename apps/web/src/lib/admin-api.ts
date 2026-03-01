import type { Story, PaginatedStories } from '@rafineri/shared';

const ADMIN_TOKEN = process.env.NEXT_PUBLIC_ADMIN_TOKEN || 'dev-admin-token';
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || '/api';

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
  return response.json();
}

export const api = {
  async get<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
        'Authorization': `Bearer ${ADMIN_TOKEN}`,
      },
    });
    return handleResponse<T>(response);
  },
};

// Admin-specific API functions
export const adminApi = {
  // Stories
  getStories: (params?: { page?: number; limit?: number; status?: string }) =>
    api.get<PaginatedStories>(`/admin/stories?${new URLSearchParams(params as Record<string, string>)}`),
  
  getStory: (id: string) =>
    api.get<Story>(`/admin/stories/${id}`),
  
  updateStory: (id: string, data: Partial<Story>) =>
    api.patch<Story>(`/admin/stories/${id}`, data),
  
  deleteStory: (id: string) =>
    api.delete<void>(`/admin/stories/${id}`),
  
  // Sources
  getSources: () =>
    api.get<Array<{ id: string; name: string; type: string; isActive: boolean }>>('/admin/sources'),
  
  updateSource: (id: string, data: { isActive: boolean }) =>
    api.patch(`/admin/sources/${id}`, data),
  
  // System
  getHealth: () =>
    api.get<{ status: string; services: Record<string, string> }>('/admin/health'),
  
  getLogs: (lines = 100) =>
    api.get<string[]>(`/admin/logs?lines=${lines}`),
  
  getMetrics: () =>
    api.get<string>('/admin/metrics'),
};
