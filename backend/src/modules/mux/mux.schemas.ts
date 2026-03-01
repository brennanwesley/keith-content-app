import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const playbackPolicySchema = z.enum(['public', 'signed']);
const videoIdSchema = z.string().uuid('Video ID must be a valid UUID.');

const createMuxDirectUploadInputSchema = z.object({
  videoId: videoIdSchema,
  playbackPolicy: playbackPolicySchema.default('public'),
});

const muxWebhookEnvelopeSchema = z.object({
  type: z.string().min(1),
  object: z.record(z.string(), z.unknown()),
});

const muxWebhookAssetCreatedObjectSchema = z.object({
  asset_id: z.string().min(1),
  passthrough: z.string().uuid().optional(),
  new_asset_settings: z
    .object({
      passthrough: z.string().uuid().optional(),
      playback_policy: z.array(playbackPolicySchema).optional(),
    })
    .optional(),
});

const muxPlaybackIdSchema = z.object({
  id: z.string().min(1),
  policy: playbackPolicySchema,
});

const muxWebhookAssetObjectSchema = z.object({
  id: z.string().min(1),
  passthrough: z.string().uuid().optional(),
  playback_ids: z.array(muxPlaybackIdSchema).optional(),
  errors: z
    .object({
      messages: z.array(z.string()).optional(),
    })
    .optional(),
});

export type PlaybackPolicy = z.infer<typeof playbackPolicySchema>;
export type CreateMuxDirectUploadInput = z.infer<
  typeof createMuxDirectUploadInputSchema
>;
export type MuxWebhookEnvelope = z.infer<typeof muxWebhookEnvelopeSchema>;
export type MuxWebhookAssetCreatedObject = z.infer<
  typeof muxWebhookAssetCreatedObjectSchema
>;
export type MuxWebhookAssetObject = z.infer<typeof muxWebhookAssetObjectSchema>;

export function parseCreateMuxDirectUploadInput(
  payload: unknown,
): CreateMuxDirectUploadInput {
  const parsed = createMuxDirectUploadInputSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid Mux direct upload payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function parseMuxWebhookEnvelope(payload: unknown): MuxWebhookEnvelope {
  const parsed = muxWebhookEnvelopeSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException('Mux webhook payload was invalid.');
  }

  return parsed.data;
}

export function parseMuxWebhookAssetCreatedObject(
  payload: unknown,
): MuxWebhookAssetCreatedObject {
  const parsed = muxWebhookAssetCreatedObjectSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException(
      'Mux upload.asset_created payload was invalid.',
    );
  }

  return parsed.data;
}

export function parseMuxWebhookAssetObject(
  payload: unknown,
): MuxWebhookAssetObject {
  const parsed = muxWebhookAssetObjectSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException('Mux asset webhook payload was invalid.');
  }

  return parsed.data;
}
