export type BackendHealthResponse = {
  status: string;
};

const apiBaseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? '';

export function readApiBaseUrl(): string {
  return apiBaseUrl;
}

function getApiBaseUrlOrThrow(): string {
  if (!apiBaseUrl) {
    throw new Error('NEXT_PUBLIC_API_BASE_URL is not configured.');
  }

  return apiBaseUrl.replace(/\/$/, '');
}

async function requestJson<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${getApiBaseUrlOrThrow()}${path}`, init);

  if (!response.ok) {
    throw new Error(`Backend returned HTTP ${response.status}`);
  }

  return (await response.json()) as T;
}

export async function getBackendHealth(): Promise<BackendHealthResponse> {
  return requestJson<BackendHealthResponse>('/health', {
    cache: 'no-store',
  });
}
