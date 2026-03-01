import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const watchEventSchema = z.object({
  videoId: z.string().uuid('Video ID must be a valid UUID.'),
  eventType: z.enum([
    'play',
    'pause',
    'progress_25',
    'progress_50',
    'progress_75',
    'complete',
    'replay',
  ]),
  positionSeconds: z
    .number()
    .int()
    .min(0, 'Position must be zero or greater.')
    .optional(),
  sessionId: z.string().uuid('Session ID must be a valid UUID.').optional(),
});

export type TrackWatchEventInput = z.infer<typeof watchEventSchema>;

export function parseTrackWatchEventInput(
  payload: unknown,
): TrackWatchEventInput {
  const parsed = watchEventSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid watch-event payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}
