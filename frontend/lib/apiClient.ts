export type BackendHealthResponse = {
  status: string;
};

type BackendErrorResponse = {
  message?: string;
};

type ApiEnvelope<TData> = {
  data: TData;
};

export type SignupRequest = {
  email: string;
  username: string;
  password: string;
};

export type SignupResult = {
  userId: string;
  email: string;
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
    emailVerified: boolean;
    hasCompletedAgeGate: boolean;
  };
};

export type ChangeEmailRequest = {
  userId: string;
  currentEmail: string;
  newEmail: string;
  password: string;
};

export type ChangeEmailResult = {
  userId: string;
  email: string;
  emailVerified: boolean;
};

export type AgeGateRequest = {
  userId: string;
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
  userId: string;
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

export async function changeEmailWithPassword(
  payload: ChangeEmailRequest,
): Promise<ChangeEmailResult> {
  const response = await requestJson<ApiEnvelope<ChangeEmailResult>>(
    '/v1/auth/change-email',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function submitAgeGate(
  payload: AgeGateRequest,
): Promise<AgeGateResult> {
  const response = await requestJson<ApiEnvelope<AgeGateResult>>(
    '/v1/onboarding/age-gate',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    },
  );

  return response.data;
}

export async function submitParentalAttestation(
  payload: ParentalAttestationRequest,
): Promise<ParentalAttestationResult> {
  const response = await requestJson<ApiEnvelope<ParentalAttestationResult>>(
    '/v1/onboarding/parental-attestation',
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
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
