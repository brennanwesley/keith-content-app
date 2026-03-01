import {
  Injectable,
  InternalServerErrorException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { z } from 'zod';
import { SupabaseService } from '../supabase/supabase.service';
import type { TrackWatchEventInput } from './engagement.schemas';

const readyVideoRowSchema = z.object({
  id: z.string().uuid(),
});

const storedWatchEventRowSchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  video_id: z.string().uuid(),
  event_type: z.enum([
    'play',
    'pause',
    'progress_25',
    'progress_50',
    'progress_75',
    'complete',
    'replay',
  ]),
  position_seconds: z.number().int().nullable(),
  occurred_at: z.string(),
  session_id: z.string().uuid().nullable(),
});

export type WatchEventResult = {
  id: string;
  userId: string;
  videoId: string;
  eventType: TrackWatchEventInput['eventType'];
  positionSeconds: number | null;
  occurredAt: string;
  sessionId: string | null;
};

@Injectable()
export class EngagementService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async trackWatchEvent(
    userId: string,
    input: TrackWatchEventInput,
  ): Promise<WatchEventResult> {
    const client = this.getClientOrThrow();

    const { data: video, error: videoError } = await client
      .from('videos')
      .select('id')
      .eq('id', input.videoId)
      .eq('status', 'ready')
      .maybeSingle();

    if (videoError) {
      throw new InternalServerErrorException(
        'Failed to verify ready video state.',
      );
    }

    if (!video) {
      throw new NotFoundException(
        'Video was not found or is not ready for tracking.',
      );
    }

    const parsedVideo = readyVideoRowSchema.safeParse(video);

    if (!parsedVideo.success) {
      throw new InternalServerErrorException(
        'Ready video payload was invalid.',
      );
    }

    const nowIso = new Date().toISOString();

    const { data: watchEvent, error: watchEventError } = await client
      .from('watch_events')
      .insert({
        user_id: userId,
        video_id: parsedVideo.data.id,
        event_type: input.eventType,
        position_seconds: input.positionSeconds ?? null,
        session_id: input.sessionId ?? null,
        occurred_at: nowIso,
      })
      .select(
        'id, user_id, video_id, event_type, position_seconds, occurred_at, session_id',
      )
      .single();

    if (watchEventError || !watchEvent) {
      throw new InternalServerErrorException('Failed to persist watch event.');
    }

    const parsedWatchEvent = storedWatchEventRowSchema.safeParse(watchEvent);

    if (!parsedWatchEvent.success) {
      throw new InternalServerErrorException(
        'Stored watch event payload was invalid.',
      );
    }

    return {
      id: parsedWatchEvent.data.id,
      userId: parsedWatchEvent.data.user_id,
      videoId: parsedWatchEvent.data.video_id,
      eventType: parsedWatchEvent.data.event_type,
      positionSeconds: parsedWatchEvent.data.position_seconds,
      occurredAt: parsedWatchEvent.data.occurred_at,
      sessionId: parsedWatchEvent.data.session_id,
    };
  }

  private getClientOrThrow() {
    try {
      return this.supabaseService.getServiceClient();
    } catch {
      throw new ServiceUnavailableException(
        'Engagement service is not configured yet. Set backend Supabase credentials.',
      );
    }
  }
}
