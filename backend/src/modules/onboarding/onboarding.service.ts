import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isIP } from 'node:net';
import { z } from 'zod';
import { SupabaseService } from '../supabase/supabase.service';
import {
  calculateAgeInYears,
  type AgeGateInput,
  type ParentalAttestationInput,
} from './onboarding.schemas';

export type AgeGateResult = {
  userId: string;
  calculatedAge: number;
  isUnder13: boolean;
  nextStep: 'direct_access' | 'parent_consent_required';
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

type ParentalAttestationContext = {
  ipAddress: string | null;
  userAgent: string | null;
};

const INTERIM_PARENTAL_ATTESTATION_TEXT =
  "By checking this box and typing my full legal name, I certify that I am the child's legal parent or guardian and I consent to the child's use of TeachTok under these Terms and Privacy Policy.";

const storedParentalConsentSchema = z.object({
  id: z.string().uuid(),
  child_user_id: z.string().uuid(),
  consent_status: z.literal('approved'),
  consent_method: z.literal('interim_attestation'),
  approved_at: z.string(),
  expires_at: z.string(),
  policy_version: z.string(),
});

@Injectable()
export class OnboardingService {
  constructor(
    private readonly supabaseService: SupabaseService,
    private readonly configService: ConfigService,
  ) {}

  async submitAgeGate(
    userId: string,
    input: AgeGateInput,
  ): Promise<AgeGateResult> {
    const client = this.getClientOrThrow();

    const birthdateDate = new Date(`${input.birthdate}T00:00:00Z`);
    const calculatedAge = calculateAgeInYears(birthdateDate);

    if (calculatedAge < 0 || calculatedAge > 120) {
      throw new InternalServerErrorException(
        'Calculated age is out of allowed bounds.',
      );
    }

    const { data: profile, error: profileError } = await client
      .from('profiles')
      .select('id')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException('Failed to verify user profile.');
    }

    if (!profile) {
      throw new NotFoundException(
        'User profile not found for age-gate request.',
      );
    }

    const { error: upsertError } = await client.from('age_gates').upsert(
      {
        user_id: userId,
        birthdate: input.birthdate,
        calculated_age_at_signup: calculatedAge,
        country_code: input.countryCode,
      },
      {
        onConflict: 'user_id',
      },
    );

    if (upsertError) {
      throw new InternalServerErrorException(
        'Failed to persist age-gate data.',
      );
    }

    const isUnder13 = calculatedAge < 13;

    return {
      userId,
      calculatedAge,
      isUnder13,
      nextStep: isUnder13 ? 'parent_consent_required' : 'direct_access',
    };
  }

  async submitParentalAttestation(
    userId: string,
    input: ParentalAttestationInput,
    context: ParentalAttestationContext,
  ): Promise<ParentalAttestationResult> {
    const client = this.getClientOrThrow();

    const { data: ageGate, error: ageGateError } = await client
      .from('age_gates')
      .select('calculated_age_at_signup')
      .eq('user_id', userId)
      .maybeSingle();

    if (ageGateError) {
      throw new InternalServerErrorException(
        'Failed to verify age-gate record.',
      );
    }

    if (!ageGate) {
      throw new BadRequestException(
        'Age gate must be completed before parental consent.',
      );
    }

    if (ageGate.calculated_age_at_signup >= 13) {
      throw new BadRequestException(
        'Parental consent is only required for under-13 users.',
      );
    }

    const now = new Date();
    const expiresAt = new Date(now);
    expiresAt.setUTCFullYear(now.getUTCFullYear() + 1);

    const policyVersion =
      this.configService.get<string>('CONSENT_POLICY_VERSION') ?? 'v1';

    const { data: consent, error: consentError } = await client
      .from('parental_consents')
      .insert({
        child_user_id: userId,
        parent_email: input.parentEmail,
        parent_full_name: input.parentFullName,
        relationship_to_child: input.relationshipToChild,
        consent_status: 'approved',
        approved_at: now.toISOString(),
        expires_at: expiresAt.toISOString(),
        policy_version: policyVersion,
        ip_address: this.normalizeIpAddress(context.ipAddress),
        user_agent: context.userAgent,
        consent_method: 'interim_attestation',
        attestation_text: INTERIM_PARENTAL_ATTESTATION_TEXT,
        attested_at: now.toISOString(),
      })
      .select(
        'id, child_user_id, consent_status, consent_method, approved_at, expires_at, policy_version',
      )
      .single();

    if (consentError || !consent) {
      throw new InternalServerErrorException(
        'Failed to store parental consent attestation.',
      );
    }

    const parsedConsent = storedParentalConsentSchema.safeParse(consent);

    if (!parsedConsent.success) {
      throw new InternalServerErrorException(
        'Stored parental consent payload was invalid.',
      );
    }

    const consentRow = parsedConsent.data;

    return {
      consentId: consentRow.id,
      childUserId: consentRow.child_user_id,
      consentStatus: consentRow.consent_status,
      consentMethod: consentRow.consent_method,
      approvedAt: consentRow.approved_at,
      expiresAt: consentRow.expires_at,
      policyVersion: consentRow.policy_version,
    };
  }

  private getClientOrThrow() {
    try {
      return this.supabaseService.getServiceClient();
    } catch {
      throw new ServiceUnavailableException(
        'Onboarding service is not configured yet. Set backend Supabase credentials.',
      );
    }
  }

  private normalizeIpAddress(candidateIp: string | null): string | null {
    if (!candidateIp) {
      return null;
    }

    const normalizedIp = candidateIp.trim();

    if (!normalizedIp || isIP(normalizedIp) === 0) {
      return null;
    }

    return normalizedIp;
  }
}
