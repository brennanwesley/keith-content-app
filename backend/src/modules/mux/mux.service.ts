import {
  ForbiddenException,
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHmac, timingSafeEqual } from 'crypto';
import { z } from 'zod';
import { SupabaseService } from '../supabase/supabase.service';
import type {
  CreateMuxDirectUploadInput,
  MuxWebhookEnvelope,
  PlaybackPolicy,
} from './mux.schemas';
import {
  parseMuxWebhookAssetCreatedObject,
  parseMuxWebhookAssetObject,
  parseMuxWebhookEnvelope,
} from './mux.schemas';

const profileAccountTypeRowSchema = z.object({
  account_type: z.enum(['learner', 'parent', 'admin']),
});

const videoRowSchema = z.object({
  id: z.string().uuid(),
  status: z.enum(['draft', 'processing', 'ready', 'blocked', 'archived']),
  published_at: z.string().nullable(),
});

const videoAssetByAssetIdRowSchema = z.object({
  video_id: z.string().uuid(),
});

const muxCreateDirectUploadResponseSchema = z.object({
  data: z.object({
    id: z.string().min(1),
    url: z.string().url(),
  }),
});

const muxSignatureSchema = z
  .string()
  .regex(/^[a-f0-9]+$/i)
  .refine((value) => value.length % 2 === 0);

type VideoStatus = z.infer<typeof videoRowSchema>['status'];
type VideoEncodingStatus = 'pending' | 'preparing' | 'ready' | 'errored';

type UpsertVideoAssetInput = {
  videoId: string;
  muxAssetId: string | null;
  muxPlaybackId: string | null;
  playbackPolicy: PlaybackPolicy;
  encodingStatus: VideoEncodingStatus;
  errorReason: string | null;
};

export type MuxDirectUploadResult = {
  videoId: string;
  uploadId: string;
  uploadUrl: string;
  playbackPolicy: PlaybackPolicy;
};

export type MuxWebhookReceipt = {
  received: true;
  eventType: string;
  handled: boolean;
};

@Injectable()
export class MuxService {
  constructor(
    private readonly configService: ConfigService,
    private readonly supabaseService: SupabaseService,
  ) {}

  async createDirectUpload(
    adminUserId: string,
    input: CreateMuxDirectUploadInput,
  ): Promise<MuxDirectUploadResult> {
    await this.assertAdminAccount(adminUserId);
    await this.getVideoByIdOrThrow(input.videoId);

    const muxUpload = await this.createMuxUpload(
      input.videoId,
      input.playbackPolicy,
    );

    await this.upsertVideoAsset({
      videoId: input.videoId,
      muxAssetId: null,
      muxPlaybackId: null,
      playbackPolicy: input.playbackPolicy,
      encodingStatus: 'pending',
      errorReason: null,
    });

    await this.updateVideoStatus(input.videoId, 'processing');

    return {
      videoId: input.videoId,
      uploadId: muxUpload.uploadId,
      uploadUrl: muxUpload.uploadUrl,
      playbackPolicy: input.playbackPolicy,
    };
  }

  async handleWebhook(
    muxSignatureHeader: string | undefined,
    rawBody: string,
    payload: unknown,
  ): Promise<MuxWebhookReceipt> {
    this.verifyWebhookSignature(muxSignatureHeader, rawBody);

    const webhookEnvelope = parseMuxWebhookEnvelope(payload);

    if (webhookEnvelope.type === 'video.upload.asset_created') {
      const handled = await this.handleVideoUploadAssetCreated(webhookEnvelope);
      return {
        received: true,
        eventType: webhookEnvelope.type,
        handled,
      };
    }

    if (webhookEnvelope.type === 'video.asset.created') {
      const handled = await this.handleVideoAssetCreated(webhookEnvelope);
      return {
        received: true,
        eventType: webhookEnvelope.type,
        handled,
      };
    }

    if (webhookEnvelope.type === 'video.asset.ready') {
      const handled = await this.handleVideoAssetReady(webhookEnvelope);
      return {
        received: true,
        eventType: webhookEnvelope.type,
        handled,
      };
    }

    if (webhookEnvelope.type === 'video.asset.errored') {
      const handled = await this.handleVideoAssetErrored(webhookEnvelope);
      return {
        received: true,
        eventType: webhookEnvelope.type,
        handled,
      };
    }

    return {
      received: true,
      eventType: webhookEnvelope.type,
      handled: false,
    };
  }

  private async handleVideoUploadAssetCreated(
    webhookEnvelope: MuxWebhookEnvelope,
  ): Promise<boolean> {
    const uploadObject = parseMuxWebhookAssetCreatedObject(
      webhookEnvelope.object,
    );
    const videoId =
      uploadObject.new_asset_settings?.passthrough ??
      uploadObject.passthrough ??
      null;

    if (!videoId) {
      return false;
    }

    const videoRow = await this.getVideoById(videoId);

    if (!videoRow) {
      return false;
    }

    const playbackPolicy =
      uploadObject.new_asset_settings?.playback_policy?.[0] ?? 'public';

    await this.upsertVideoAsset({
      videoId,
      muxAssetId: uploadObject.asset_id,
      muxPlaybackId: null,
      playbackPolicy,
      encodingStatus: 'preparing',
      errorReason: null,
    });

    await this.updateVideoStatus(videoId, 'processing');

    return true;
  }

  private async handleVideoAssetCreated(
    webhookEnvelope: MuxWebhookEnvelope,
  ): Promise<boolean> {
    const assetObject = parseMuxWebhookAssetObject(webhookEnvelope.object);
    const videoId = await this.resolveVideoIdForAssetEvent({
      muxAssetId: assetObject.id,
      passthroughVideoId: assetObject.passthrough ?? null,
    });

    if (!videoId) {
      return false;
    }

    const existingVideo = await this.getVideoById(videoId);

    if (!existingVideo) {
      return false;
    }

    await this.upsertVideoAsset({
      videoId,
      muxAssetId: assetObject.id,
      muxPlaybackId: null,
      playbackPolicy: 'public',
      encodingStatus: 'preparing',
      errorReason: null,
    });

    await this.updateVideoStatus(videoId, 'processing');

    return true;
  }

  private async handleVideoAssetReady(
    webhookEnvelope: MuxWebhookEnvelope,
  ): Promise<boolean> {
    const assetObject = parseMuxWebhookAssetObject(webhookEnvelope.object);
    const videoId = await this.resolveVideoIdForAssetEvent({
      muxAssetId: assetObject.id,
      passthroughVideoId: assetObject.passthrough ?? null,
    });

    if (!videoId) {
      return false;
    }

    const existingVideo = await this.getVideoById(videoId);

    if (!existingVideo) {
      return false;
    }

    const selectedPlaybackId = this.selectPlaybackId(
      assetObject.playback_ids ?? [],
    );

    if (!selectedPlaybackId) {
      await this.upsertVideoAsset({
        videoId,
        muxAssetId: assetObject.id,
        muxPlaybackId: null,
        playbackPolicy: 'public',
        encodingStatus: 'errored',
        errorReason:
          'Mux asset.ready webhook did not contain a playback ID for this asset.',
      });

      await this.updateVideoStatus(videoId, 'blocked');
      return true;
    }

    await this.upsertVideoAsset({
      videoId,
      muxAssetId: assetObject.id,
      muxPlaybackId: selectedPlaybackId.id,
      playbackPolicy: selectedPlaybackId.policy,
      encodingStatus: 'ready',
      errorReason: null,
    });

    await this.updateVideoStatus(videoId, 'ready');

    return true;
  }

  private async handleVideoAssetErrored(
    webhookEnvelope: MuxWebhookEnvelope,
  ): Promise<boolean> {
    const assetObject = parseMuxWebhookAssetObject(webhookEnvelope.object);
    const videoId = await this.resolveVideoIdForAssetEvent({
      muxAssetId: assetObject.id,
      passthroughVideoId: assetObject.passthrough ?? null,
    });

    if (!videoId) {
      return false;
    }

    const existingVideo = await this.getVideoById(videoId);

    if (!existingVideo) {
      return false;
    }

    const errorReason =
      assetObject.errors?.messages?.join(' | ') ??
      'Mux reported an unrecoverable encoding error.';

    await this.upsertVideoAsset({
      videoId,
      muxAssetId: assetObject.id,
      muxPlaybackId: null,
      playbackPolicy: 'public',
      encodingStatus: 'errored',
      errorReason,
    });

    await this.updateVideoStatus(videoId, 'blocked');

    return true;
  }

  private selectPlaybackId(
    playbackIds: Array<{ id: string; policy: PlaybackPolicy }>,
  ) {
    return (
      playbackIds.find((playbackId) => playbackId.policy === 'public') ??
      playbackIds[0] ??
      null
    );
  }

  private async resolveVideoIdForAssetEvent(input: {
    muxAssetId: string;
    passthroughVideoId: string | null;
  }): Promise<string | null> {
    if (input.passthroughVideoId) {
      return input.passthroughVideoId;
    }

    const client = this.getClientOrThrow();

    const { data: videoAssetRow, error: videoAssetError } = await client
      .from('video_assets')
      .select('video_id')
      .eq('mux_asset_id', input.muxAssetId)
      .maybeSingle();

    if (videoAssetError) {
      throw new InternalServerErrorException(
        'Failed to resolve video asset link for Mux webhook.',
      );
    }

    if (!videoAssetRow) {
      return null;
    }

    const parsedVideoAssetRow =
      videoAssetByAssetIdRowSchema.safeParse(videoAssetRow);

    if (!parsedVideoAssetRow.success) {
      throw new InternalServerErrorException(
        'Video asset lookup payload was invalid for Mux webhook.',
      );
    }

    return parsedVideoAssetRow.data.video_id;
  }

  private async upsertVideoAsset(input: UpsertVideoAssetInput): Promise<void> {
    const client = this.getClientOrThrow();

    const { error: upsertError } = await client.from('video_assets').upsert(
      {
        video_id: input.videoId,
        provider: 'mux',
        mux_asset_id: input.muxAssetId,
        mux_playback_id: input.muxPlaybackId,
        playback_policy: input.playbackPolicy,
        encoding_status: input.encodingStatus,
        error_reason: input.errorReason,
      },
      { onConflict: 'video_id' },
    );

    if (upsertError) {
      throw new InternalServerErrorException(
        'Failed to upsert video asset metadata.',
      );
    }
  }

  private async updateVideoStatus(
    videoId: string,
    status: VideoStatus,
  ): Promise<void> {
    const existingVideo = await this.getVideoById(videoId);

    if (!existingVideo) {
      throw new NotFoundException('Video was not found.');
    }

    const patch: Record<string, unknown> = {
      status,
    };

    if (status === 'ready' && existingVideo.published_at === null) {
      patch.published_at = new Date().toISOString();
    }

    const client = this.getClientOrThrow();

    const { error: updateError } = await client
      .from('videos')
      .update(patch)
      .eq('id', videoId);

    if (updateError) {
      throw new InternalServerErrorException(
        'Failed to update video lifecycle status.',
      );
    }
  }

  private async getVideoByIdOrThrow(videoId: string) {
    const videoRow = await this.getVideoById(videoId);

    if (!videoRow) {
      throw new NotFoundException('Video was not found.');
    }

    return videoRow;
  }

  private async getVideoById(videoId: string) {
    const client = this.getClientOrThrow();

    const { data: videoRow, error: videoError } = await client
      .from('videos')
      .select('id, status, published_at')
      .eq('id', videoId)
      .maybeSingle();

    if (videoError) {
      throw new InternalServerErrorException('Failed to load video details.');
    }

    if (!videoRow) {
      return null;
    }

    const parsedVideoRow = videoRowSchema.safeParse(videoRow);

    if (!parsedVideoRow.success) {
      throw new InternalServerErrorException(
        'Video detail payload was invalid.',
      );
    }

    return parsedVideoRow.data;
  }

  private async createMuxUpload(
    videoId: string,
    playbackPolicy: PlaybackPolicy,
  ): Promise<{ uploadId: string; uploadUrl: string }> {
    const responsePayload = await this.requestMuxJson('/video/v1/uploads', {
      method: 'POST',
      body: {
        cors_origin: this.configService
          .get<string>('CORS_ORIGINS')
          ?.split(',')
          .map((origin) => origin.trim())
          .filter(Boolean)[0],
        new_asset_settings: {
          playback_policy: [playbackPolicy],
          passthrough: videoId,
        },
      },
    });

    const parsedMuxResponse =
      muxCreateDirectUploadResponseSchema.safeParse(responsePayload);

    if (!parsedMuxResponse.success) {
      throw new InternalServerErrorException(
        'Mux direct upload response payload was invalid.',
      );
    }

    return {
      uploadId: parsedMuxResponse.data.data.id,
      uploadUrl: parsedMuxResponse.data.data.url,
    };
  }

  private verifyWebhookSignature(
    muxSignatureHeader: string | undefined,
    rawBody: string,
  ): void {
    if (!muxSignatureHeader) {
      throw new UnauthorizedException('Mux webhook signature was missing.');
    }

    const muxWebhookSigningSecret = this.getWebhookSigningSecretOrThrow();
    const parsedSignature = this.parseMuxSignatureHeader(muxSignatureHeader);

    if (
      Math.abs(Math.floor(Date.now() / 1000) - parsedSignature.timestamp) > 300
    ) {
      throw new UnauthorizedException(
        'Mux webhook signature timestamp was stale.',
      );
    }

    const expectedSignature = createHmac('sha256', muxWebhookSigningSecret)
      .update(`${parsedSignature.timestamp}.${rawBody}`)
      .digest('hex');

    const isMatch = parsedSignature.v1Signatures.some((candidateSignature) =>
      this.isSafeHexSignatureMatch(expectedSignature, candidateSignature),
    );

    if (!isMatch) {
      throw new UnauthorizedException('Mux webhook signature was invalid.');
    }
  }

  private parseMuxSignatureHeader(signatureHeader: string): {
    timestamp: number;
    v1Signatures: string[];
  } {
    const signatureParts = signatureHeader
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean);

    const timestampPart = signatureParts.find((part) => part.startsWith('t='));
    const v1Signatures = signatureParts
      .filter((part) => part.startsWith('v1='))
      .map((part) => part.slice(3))
      .filter(Boolean);

    if (!timestampPart || v1Signatures.length === 0) {
      throw new UnauthorizedException(
        'Mux webhook signature format was invalid.',
      );
    }

    const timestamp = Number(timestampPart.slice(2));

    if (!Number.isInteger(timestamp)) {
      throw new UnauthorizedException(
        'Mux webhook signature timestamp was invalid.',
      );
    }

    return {
      timestamp,
      v1Signatures,
    };
  }

  private isSafeHexSignatureMatch(
    expectedSignature: string,
    candidateSignature: string,
  ): boolean {
    const parsedExpectedSignature =
      muxSignatureSchema.safeParse(expectedSignature);
    const parsedCandidateSignature =
      muxSignatureSchema.safeParse(candidateSignature);

    if (!parsedExpectedSignature.success || !parsedCandidateSignature.success) {
      return false;
    }

    const expectedBuffer = Buffer.from(parsedExpectedSignature.data, 'hex');
    const candidateBuffer = Buffer.from(parsedCandidateSignature.data, 'hex');

    if (
      expectedBuffer.length !== candidateBuffer.length ||
      expectedBuffer.length === 0
    ) {
      return false;
    }

    return timingSafeEqual(expectedBuffer, candidateBuffer);
  }

  private async requestMuxJson(
    path: string,
    init: {
      method: 'POST';
      body: Record<string, unknown>;
    },
  ): Promise<unknown> {
    const muxCredentials = this.getMuxCredentialsOrThrow();

    let response: Response;

    try {
      response = await fetch(`https://api.mux.com${path}`, {
        method: init.method,
        headers: {
          Authorization: `Basic ${muxCredentials.basicAuthorizationToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(init.body),
      });
    } catch {
      throw new ServiceUnavailableException(
        'Unable to reach Mux API right now.',
      );
    }

    let responsePayload: unknown;

    try {
      responsePayload = await response.json();
    } catch {
      responsePayload = null;
    }

    if (!response.ok) {
      const errorMessage =
        typeof responsePayload === 'object' && responsePayload !== null
          ? z
              .object({
                error: z
                  .object({
                    messages: z.array(z.string()).optional(),
                  })
                  .optional(),
              })
              .safeParse(responsePayload)
          : null;

      const parsedErrorMessage =
        errorMessage && errorMessage.success
          ? errorMessage.data.error?.messages?.join(' | ')
          : null;

      throw new InternalServerErrorException(
        parsedErrorMessage ??
          `Mux API request failed with HTTP ${response.status}. Verify Mux credentials and webhook setup.`,
      );
    }

    return responsePayload;
  }

  private async assertAdminAccount(userId: string): Promise<void> {
    const client = this.getClientOrThrow();

    const { data: profileRow, error: profileError } = await client
      .from('profiles')
      .select('account_type')
      .eq('id', userId)
      .maybeSingle();

    if (profileError) {
      throw new InternalServerErrorException('Failed to load account profile.');
    }

    if (!profileRow) {
      throw new NotFoundException('Account profile was not found.');
    }

    const parsedProfileRow = profileAccountTypeRowSchema.safeParse(profileRow);

    if (!parsedProfileRow.success) {
      throw new InternalServerErrorException(
        'Account type payload was invalid.',
      );
    }

    if (parsedProfileRow.data.account_type !== 'admin') {
      throw new ForbiddenException(
        'Only admin accounts can manage Mux uploads.',
      );
    }
  }

  private getMuxCredentialsOrThrow() {
    const muxTokenId = this.configService.get<string>('MUX_TOKEN_ID');
    const muxTokenSecret = this.configService.get<string>('MUX_TOKEN_SECRET');

    if (!muxTokenId || !muxTokenSecret) {
      throw new ServiceUnavailableException(
        'Mux credentials are not configured. Set MUX_TOKEN_ID and MUX_TOKEN_SECRET.',
      );
    }

    return {
      tokenId: muxTokenId,
      tokenSecret: muxTokenSecret,
      basicAuthorizationToken: Buffer.from(
        `${muxTokenId}:${muxTokenSecret}`,
      ).toString('base64'),
    };
  }

  private getWebhookSigningSecretOrThrow() {
    const muxWebhookSigningSecret = this.configService.get<string>(
      'MUX_WEBHOOK_SIGNING_SECRET',
    );

    if (!muxWebhookSigningSecret) {
      throw new ServiceUnavailableException(
        'Mux webhook signing secret is not configured. Set MUX_WEBHOOK_SIGNING_SECRET.',
      );
    }

    return muxWebhookSigningSecret;
  }

  private getClientOrThrow() {
    try {
      return this.supabaseService.getServiceClient();
    } catch {
      throw new ServiceUnavailableException(
        'Mux service is not configured yet. Set backend Supabase credentials.',
      );
    }
  }
}
