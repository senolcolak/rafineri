import type { Story, PaginatedStories, Label } from '@rafineri/shared';

// Use relative path so Next.js rewrites handle the proxying
const API_BASE_URL = '/api';
const USE_MOCK = false;
const REQUEST_TIMEOUT_MS = Number.parseInt(process.env.NEXT_PUBLIC_API_TIMEOUT_MS || '15000', 10) || 15000;

class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public data?: unknown
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

async function handleResponse<T>(response: Response): Promise<T> {
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(
      errorData.message || `HTTP error! status: ${response.status}`,
      response.status,
      errorData
    );
  }
  return response.json();
}

export const api = {
  async get<T>(path: string): Promise<T> {
    if (USE_MOCK) {
      return mockApiRequest<T>(path);
    }
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      headers: {
        'Accept': 'application/json',
      },
    });
    return handleResponse<T>(response);
  },

  async post<T>(path: string, body: unknown): Promise<T> {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  },

  async patch<T>(path: string, body: unknown): Promise<T> {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return handleResponse<T>(response);
  },

  async delete<T>(path: string): Promise<T> {
    const response = await fetchWithTimeout(`${API_BASE_URL}${path}`, {
      method: 'DELETE',
      headers: {
        'Accept': 'application/json',
      },
    });
    return handleResponse<T>(response);
  },
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
      throw new ApiError(`Request timed out after ${REQUEST_TIMEOUT_MS}ms`, 504);
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

// Mock data for development
const mockStories: Story[] = [
  {
    id: '1',
    title: 'Scientists discover new renewable energy breakthrough',
    summary: 'Researchers at MIT have developed a novel solar cell technology that achieves 40% efficiency, potentially revolutionizing the renewable energy sector.',
    url: 'https://example.com/solar-breakthrough',
    imageUrl: 'https://images.unsplash.com/photo-1509391366360-2e959784a276?w=400',
    label: 'verified',
    confidence: 0.92,
    score: 92,
    category: 'Science',
    evidenceCount: 15,
    contradictionsCount: 1,
    seenOn: ['hn', 'reddit'],
    publishedAt: new Date(Date.now() - 86400000).toISOString(),
    first_seen_at: new Date(Date.now() - 86400000),
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '2',
    title: 'New study links coffee consumption to longer lifespan',
    summary: 'A comprehensive 20-year study involving 500,000 participants suggests that moderate coffee consumption may be associated with increased longevity.',
    url: 'https://example.com/coffee-study',
    imageUrl: 'https://images.unsplash.com/photo-1495474472287-4d71bcdd2085?w=400',
    label: 'likely',
    confidence: 0.75,
    score: 75,
    category: 'Health',
    evidenceCount: 8,
    contradictionsCount: 3,
    seenOn: ['hn'],
    publishedAt: new Date(Date.now() - 172800000).toISOString(),
    first_seen_at: new Date(Date.now() - 172800000),
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '3',
    title: 'Tech company announces quantum computing breakthrough',
    summary: 'Claims of achieving quantum supremacy with a 1000-qubit processor have sparked debate in the scientific community.',
    url: 'https://example.com/quantum-claim',
    imageUrl: 'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400',
    label: 'contested',
    confidence: 0.45,
    score: 45,
    category: 'Technology',
    evidenceCount: 4,
    contradictionsCount: 7,
    seenOn: ['reddit'],
    publishedAt: new Date(Date.now() - 43200000).toISOString(),
    first_seen_at: new Date(Date.now() - 43200000),
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '4',
    title: 'Unverified claims about ancient civilizations discovered',
    summary: 'Social media posts suggest discovery of previously unknown ancient structures, but no peer-reviewed evidence has been presented.',
    url: 'https://example.com/ancient-claim',
    imageUrl: null,
    label: 'unverified',
    confidence: 0.15,
    score: 15,
    category: 'History',
    evidenceCount: 0,
    contradictionsCount: 0,
    seenOn: ['reddit'],
    publishedAt: new Date(Date.now() - 3600000).toISOString(),
    first_seen_at: new Date(Date.now() - 3600000),
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '5',
    title: 'AI model demonstrates human-level reasoning in new benchmark',
    summary: 'Latest evaluation shows significant progress in artificial general intelligence research, though experts urge caution in interpretation.',
    url: 'https://example.com/ai-reasoning',
    imageUrl: 'https://images.unsplash.com/photo-1677442136019-21780ecad995?w=400',
    label: 'verified',
    confidence: 0.88,
    score: 88,
    category: 'Technology',
    evidenceCount: 12,
    contradictionsCount: 2,
    seenOn: ['hn', 'manual'],
    publishedAt: new Date(Date.now() - 259200000).toISOString(),
    first_seen_at: new Date(Date.now() - 259200000),
    created_at: new Date(),
    updated_at: new Date(),
  },
  {
    id: '6',
    title: 'Climate change report shows accelerating ice melt',
    summary: 'Satellite data confirms unprecedented rates of polar ice loss, with significant implications for global sea levels.',
    url: 'https://example.com/ice-melt',
    imageUrl: 'https://images.unsplash.com/photo-1518182170546-0766bc6f9213?w=400',
    label: 'verified',
    confidence: 0.95,
    score: 95,
    category: 'Environment',
    evidenceCount: 23,
    contradictionsCount: 2,
    seenOn: ['hn', 'reddit', 'manual'],
    publishedAt: new Date(Date.now() - 432000000).toISOString(),
    first_seen_at: new Date(Date.now() - 432000000),
    created_at: new Date(),
    updated_at: new Date(),
  },
];

// Mock API implementation
async function mockApiRequest<T>(path: string): Promise<T> {
  // Parse query parameters
  const url = new URL(path, 'http://localhost');
  const params = url.searchParams;
  
  if (url.pathname === '/stories') {
    return mockGetStories(params) as T;
  }
  
  if (url.pathname.match(/^\/stories\/[^/]+$/)) {
    const id = url.pathname.split('/')[2];
    return mockGetStory(id) as T;
  }
  
  if (url.pathname === '/categories') {
    return mockGetCategories() as T;
  }
  
  throw new ApiError('Not found', 404);
}

function mockGetStories(params: URLSearchParams): PaginatedStories {
  const page = parseInt(params.get('page') || '1');
  const limit = parseInt(params.get('limit') || '20');
  const sort = params.get('sort') || 'hot';
  const labels = params.getAll('label') as Label[];
  const sources = params.getAll('source');
  const category = params.get('category') || undefined;
  const q = params.get('q') || undefined;

  let filtered = [...mockStories];

  // Apply filters
  if (labels.length) {
    filtered = filtered.filter((s) => labels.includes(s.label));
  }
  if (sources.length) {
    filtered = filtered.filter((s) =>
      s.seenOn.some((source) => sources.includes(source))
    );
  }
  if (category) {
    filtered = filtered.filter((s) => s.category === category);
  }
  if (q) {
    const query = q.toLowerCase();
    filtered = filtered.filter(
      (s) =>
        s.title.toLowerCase().includes(query) ||
        (s.summary?.toLowerCase().includes(query) ?? false)
    );
  }

  // Apply sorting
  switch (sort) {
    case 'newest':
      filtered.sort(
        (a, b) =>
          new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime()
      );
      break;
    case 'verified':
      filtered = filtered.filter((s) => s.label === 'verified');
      filtered.sort((a, b) => b.score - a.score);
      break;
    case 'contested':
      filtered = filtered.filter((s) => s.label === 'contested');
      filtered.sort((a, b) => b.contradictionsCount - a.contradictionsCount);
      break;
    case 'hot':
    default:
      filtered.sort((a, b) => b.score - a.score);
  }

  const start = (page - 1) * limit;
  const end = start + limit;
  const paginated = filtered.slice(start, end);

  return {
    stories: paginated,
    page,
    limit,
    total: filtered.length,
    totalPages: Math.ceil(filtered.length / limit),
  };
}

function mockGetStory(id: string): Story | undefined {
  return mockStories.find((s) => s.id === id);
}

function mockGetCategories(): Array<{ name: string; count: number }> {
  const categories = mockStories.reduce((acc, story) => {
    acc[story.category] = (acc[story.category] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return Object.entries(categories)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);
}

export const mockApi = {
  getStories: (params: URLSearchParams) => Promise.resolve(mockGetStories(params)),
  getStory: (id: string) => Promise.resolve(mockGetStory(id)),
  getCategories: () => Promise.resolve(mockGetCategories()),
};
