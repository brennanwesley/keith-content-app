export type BackendHealthResponse = {
  status: string;
};

type BackendErrorResponse = {
  message?: string;
};

type ApiEnvelope<TData> = {
  data: TData;
};

export type AccountType = 'learner' | 'parent' | 'admin';

export type SignupRequest = {
  email: string;
  username: string;
  password: string;
  accountType?: Extract<AccountType, 'learner' | 'parent'>;
};

export type SignupResult = {
  userId: string;
  email: string;
  accountType: AccountType;
  requiresEmailVerification: boolean;
};

export type LoginRequest = {
  email: string;
  password: string;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    email: string;
    accountType: AccountType;
    emailVerified: boolean;
    hasCompletedAgeGate: boolean;
  };
};

export type ChangeEmailRequest = {
  newEmail: string;
  password: string;
};

export type ChangeEmailResult = {
  userId: string;
  email: string;
  emailVerified: boolean;
};

export type ContentTypeSummary = {
  id: string;
  slug: string;
  name: string;
  description: string;
  iconKey: string | null;
  sortOrder: number;
  isActive: boolean;
};

export type MyContentPreferencesResult = {
  userId: string;
  selectedContentTypeIds: string[];
  selectedContentTypes: ContentTypeSummary[];
};

export type EffectiveContentPreferencesResult = {
  userId: string;
  selectedContentTypeIds: string[];
  selectedContentTypes: ContentTypeSummary[];
  blockedContentTypeIds: string[];
  blockedContentTypes: ContentTypeSummary[];
  effectiveContentTypeIds: string[];
  effectiveContentTypes: ContentTypeSummary[];
  isParentRestricted: boolean;
};

export type UpdateMyContentPreferencesRequest = {
  contentTypeIds: string[];
};

export type AgeGateRequest = {
  birthdate: string;
  countryCode: string;
};

export type AgeGateResult = {
  userId: string;
  calculatedAge: number;
  isUnder13: boolean;
  nextStep: 'direct_access' | 'parent_consent_required';
};

export type ParentalAttestationRequest = {
  parentEmail: string;
  parentFullName: string;
  relationshipToChild: string;
  attestationAccepted: boolean;
};

export type ParentalAttestationResult = {
  consentId: string;
  childUserId: string;
  consentStatus: 'approved';
  consentMethod: 'interim_attestation';
  approvedAt: string;
  expiresAt: string;
  policyVersion: string;
};

export type ParentLinkSummary = {
  id: string;
  parentUserId: string;
  parentUsername: string;
  childUserId: string;
  childUsername: string;
  relationshipStatus: 'pending' | 'active' | 'revoked';
  linkedAt: string | null;
  createdAt: string;
  updatedAt: string;
};

export type MyParentLinksResult = {
  userId: string;
  accountType: AccountType;
  asParent: ParentLinkSummary[];
  asChild: ParentLinkSummary[];
};

export type RequestParentLinkRequest = {
  childUsername: string;
};

export type UpdateChildContentRestrictionsRequest = {
  blockedContentTypeIds: string[];
};

export type ChildContentRestrictionsResult = {
  parentUserId: string;
  childUserId: string;
  childUsername: string;
  blockedContentTypeIds: string[];
  blockedContentTypes: ContentTypeSummary[];
  effectiveContentPreferences: EffectiveContentPreferencesResult;
};

export type VideoStatus =
  | 'draft'
  | 'processing'
  | 'ready'
  | 'blocked'
  | 'archived';

export type AdminVideoSummary = {
  id: string;
  title: string;
  description: string | null;
  status: VideoStatus;
  ownerId: string | null;
  durationSeconds: number | null;
  thumbnailUrl: string | null;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
  contentTypeIds: string[];
  contentTypes: ContentTypeSummary[];
};

export type CreateAdminVideoRequest = {
  title: string;
  description?: string | null;
  status?: VideoStatus;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  contentTypeIds?: string[];
};

export type UpdateAdminVideoRequest = {
  title?: string;
  description?: string | null;
  status?: VideoStatus;
  durationSeconds?: number | null;
  thumbnailUrl?: string | null;
  publishedAt?: string | null;
  contentTypeIds?: string[];
};

export type ListAdminVideosQuery = {
  status?: VideoStatus;
};

export type CreateMuxDirectUploadRequest = {
  videoId: string;
  playbackPolicy?: 'public' | 'signed';
};

export type CreateMuxDirectUploadResult = {
  videoId: string;
  uploadId: string;
  uploadUrl: string;
  playbackPolicy: 'public' | 'signed';
};

export type WatchEventType =
  | 'play'
  | 'pause'
  | 'progress_25'
  | 'progress_50'
  | 'progress_75'
  | 'complete'
  | 'replay';

export type TrackWatchEventRequest = {
  videoId: string;
  eventType: WatchEventType;
  positionSeconds?: number;
  sessionId?: string;
};

export type WatchEventResult = {
  id: string;
  userId: string;
  videoId: string;
  eventType: WatchEventType;
  positionSeconds: number | null;
  occurredAt: string;
  sessionId: string | null;
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
    let backendMessage: string | undefined;

    try {
      const errorPayload = (await response.json()) as BackendErrorResponse;
      backendMessage = errorPayload.message;
    } catch {
      backendMessage = undefined;
    }

    throw new Error(
      backendMessage ?? `Backend returned HTTP ${response.status}`,
    );
  }

  return (await response.json()) as T;
}

function toQueryString(query: Record<string, string | undefined>): string {
  const searchParams = new URLSearchParams();

  for (const [key, value] of Object.entries(query)) {
    if (value) {
      searchParams.set(key, value);
    }
  }

  const serialized = searchParams.toString();
  return serialized ? `?${serialized}` : '';
}

function readBearerTokenOrThrow(accessToken: string): string {
  const trimmedToken = accessToken.trim();

  if (!trimmedToken) {
    throw new Error('Access token is required for this request.');
  }

  return trimmedToken;
}

export async function getBackendHealth(): Promise<BackendHealthResponse> {
  return requestJson<BackendHealthResponse>('/health', {
    cache: 'no-store',
  });
}

export async function signupWithEmail(
  payload: SignupRequest,
): Promise<SignupResult> {
  const response = await requestJson<ApiEnvelope<SignupResult>>('/v1/auth/signup', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.data;
}

export async function createMuxDirectUpload(
  accessToken: string,
  payload: CreateMuxDirectUploadRequest,
): Promise<CreateMuxDirectUploadResult> {
  const response = await requestJson<ApiEnvelope<CreateMuxDirectUploadResult>>(
    '/v1/mux/uploads',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function listAdminVideos(
  accessToken: string,
  query?: ListAdminVideosQuery,
): Promise<AdminVideoSummary[]> {
  const response = await requestJson<ApiEnvelope<AdminVideoSummary[]>>(
    `/v1/admin/videos${toQueryString({ status: query?.status })}`,
    {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
    },
  );

  return response.data;
}

export async function createAdminVideo(
  accessToken: string,
  payload: CreateAdminVideoRequest,
): Promise<AdminVideoSummary> {
  const response = await requestJson<ApiEnvelope<AdminVideoSummary>>(
    '/v1/admin/videos',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function updateAdminVideo(
  accessToken: string,
  videoId: string,
  payload: UpdateAdminVideoRequest,
): Promise<AdminVideoSummary> {
  const response = await requestJson<ApiEnvelope<AdminVideoSummary>>(
    `/v1/admin/videos/${encodeURIComponent(videoId)}`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function getMyEffectiveContentPreferences(
  accessToken: string,
): Promise<EffectiveContentPreferencesResult> {
  const response = await requestJson<ApiEnvelope<EffectiveContentPreferencesResult>>(
    '/v1/me/effective-content-preferences',
    {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
    },
  );

  return response.data;
}

export async function getContentTypes(): Promise<ContentTypeSummary[]> {
  const response = await requestJson<ApiEnvelope<ContentTypeSummary[]>>(
    '/v1/content-types',
    {
      cache: 'no-store',
    },
  );

  return response.data;
}

export async function getMyContentPreferences(
  accessToken: string,
): Promise<MyContentPreferencesResult> {
  const response = await requestJson<ApiEnvelope<MyContentPreferencesResult>>(
    '/v1/me/content-preferences',
    {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
    },
  );

  return response.data;
}

export async function updateMyContentPreferences(
  accessToken: string,
  payload: UpdateMyContentPreferencesRequest,
): Promise<MyContentPreferencesResult> {
  const response = await requestJson<ApiEnvelope<MyContentPreferencesResult>>(
    '/v1/me/content-preferences',
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function changeEmailWithPassword(
  accessToken: string,
  payload: ChangeEmailRequest,
): Promise<ChangeEmailResult> {
  const response = await requestJson<ApiEnvelope<ChangeEmailResult>>(
    '/v1/auth/change-email',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function submitAgeGate(
  accessToken: string,
  payload: AgeGateRequest,
): Promise<AgeGateResult> {
  const response = await requestJson<ApiEnvelope<AgeGateResult>>(
    '/v1/onboarding/age-gate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function submitParentalAttestation(
  accessToken: string,
  payload: ParentalAttestationRequest,
): Promise<ParentalAttestationResult> {
  const response = await requestJson<ApiEnvelope<ParentalAttestationResult>>(
    '/v1/onboarding/parental-attestation',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function getMyParentLinks(
  accessToken: string,
): Promise<MyParentLinksResult> {
  const response = await requestJson<ApiEnvelope<MyParentLinksResult>>(
    '/v1/parent/links',
    {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
    },
  );

  return response.data;
}

export async function requestParentLink(
  accessToken: string,
  payload: RequestParentLinkRequest,
): Promise<ParentLinkSummary> {
  const response = await requestJson<ApiEnvelope<ParentLinkSummary>>(
    '/v1/parent/links/request',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function acceptParentLink(
  accessToken: string,
  linkId: string,
): Promise<ParentLinkSummary> {
  const response = await requestJson<ApiEnvelope<ParentLinkSummary>>(
    `/v1/parent/links/${encodeURIComponent(linkId)}/accept`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
    },
  );

  return response.data;
}

export async function revokeParentLink(
  accessToken: string,
  linkId: string,
): Promise<ParentLinkSummary> {
  const response = await requestJson<ApiEnvelope<ParentLinkSummary>>(
    `/v1/parent/links/${encodeURIComponent(linkId)}/revoke`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
    },
  );

  return response.data;
}

export async function getChildContentRestrictions(
  accessToken: string,
  childUserId: string,
): Promise<ChildContentRestrictionsResult> {
  const response = await requestJson<ApiEnvelope<ChildContentRestrictionsResult>>(
    `/v1/parent/children/${encodeURIComponent(childUserId)}/content-restrictions`,
    {
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
    },
  );

  return response.data;
}

export async function updateChildContentRestrictions(
  accessToken: string,
  childUserId: string,
  payload: UpdateChildContentRestrictionsRequest,
): Promise<ChildContentRestrictionsResult> {
  const response = await requestJson<ApiEnvelope<ChildContentRestrictionsResult>>(
    `/v1/parent/children/${encodeURIComponent(childUserId)}/content-restrictions`,
    {
      method: 'PUT',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function trackWatchEvent(
  accessToken: string,
  payload: TrackWatchEventRequest,
): Promise<WatchEventResult> {
  const response = await requestJson<ApiEnvelope<WatchEventResult>>(
    '/v1/engagement/watch-events',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${readBearerTokenOrThrow(accessToken)}`,
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function loginWithEmail(payload: LoginRequest): Promise<LoginResult> {
  const response = await requestJson<ApiEnvelope<LoginResult>>('/v1/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(payload),
  });

  return response.data;
}
