import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { contentTypeIdSchema } from '../content/content-id.schema';

export const videoStatusSchema = z.enum([
  'draft',
  'processing',
  'ready',
  'blocked',
  'archived',
]);

const videoIdSchema = z.string().uuid('Video ID must be a valid UUID.');

const nullableIsoDateTimeSchema = z
  .string()
  .datetime({
    offset: true,
    message: 'Published date must be an ISO-8601 timestamp with timezone.',
  })
  .transform((value) => new Date(value).toISOString());

const createAdminVideoSchema = z.object({
  title: z
    .string()
    .trim()
    .min(3, 'Video title must be at least 3 characters.')
    .max(160, 'Video title must be at most 160 characters.'),
  description: z
    .string()
    .trim()
    .max(2000, 'Description must be at most 2000 characters.')
    .nullable()
    .optional(),
  status: videoStatusSchema.default('draft'),
  durationSeconds: z
    .number()
    .int('Duration must be a whole number of seconds.')
    .min(0, 'Duration must be non-negative.')
    .nullable()
    .optional(),
  thumbnailUrl: z
    .string()
    .trim()
    .url('Thumbnail URL must be a valid URL.')
    .max(2000, 'Thumbnail URL must be at most 2000 characters.')
    .nullable()
    .optional(),
  publishedAt: nullableIsoDateTimeSchema.nullable().optional(),
  contentTypeIds: z
    .array(contentTypeIdSchema)
    .max(25, 'You can assign up to 25 content types to one video.')
    .default([])
    .transform((contentTypeIds) => Array.from(new Set(contentTypeIds))),
});

const updateAdminVideoSchema = z
  .object({
    title: z
      .string()
      .trim()
      .min(3, 'Video title must be at least 3 characters.')
      .max(160, 'Video title must be at most 160 characters.')
      .optional(),
    description: z
      .string()
      .trim()
      .max(2000, 'Description must be at most 2000 characters.')
      .nullable()
      .optional(),
    status: videoStatusSchema.optional(),
    durationSeconds: z
      .number()
      .int('Duration must be a whole number of seconds.')
      .min(0, 'Duration must be non-negative.')
      .nullable()
      .optional(),
    thumbnailUrl: z
      .string()
      .trim()
      .url('Thumbnail URL must be a valid URL.')
      .max(2000, 'Thumbnail URL must be at most 2000 characters.')
      .nullable()
      .optional(),
    publishedAt: nullableIsoDateTimeSchema.nullable().optional(),
    contentTypeIds: z
      .array(contentTypeIdSchema)
      .max(25, 'You can assign up to 25 content types to one video.')
      .optional()
      .transform((contentTypeIds) => {
        if (!contentTypeIds) {
          return undefined;
        }

        return Array.from(new Set(contentTypeIds));
      }),
  })
  .superRefine((value, context) => {
    if (
      value.title === undefined &&
      value.description === undefined &&
      value.status === undefined &&
      value.durationSeconds === undefined &&
      value.thumbnailUrl === undefined &&
      value.publishedAt === undefined &&
      value.contentTypeIds === undefined
    ) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update.',
      });
    }
  });

const listAdminVideosQuerySchema = z.object({
  status: videoStatusSchema.optional(),
});

export type CreateAdminVideoInput = z.infer<typeof createAdminVideoSchema>;
export type UpdateAdminVideoInput = z.infer<typeof updateAdminVideoSchema>;
export type ListAdminVideosQuery = z.infer<typeof listAdminVideosQuerySchema>;
export type VideoStatus = z.infer<typeof videoStatusSchema>;

export function parseVideoId(rawValue: unknown): string {
  const parsed = videoIdSchema.safeParse(rawValue);

  if (!parsed.success) {
    throw new BadRequestException('Video ID was invalid.');
  }

  return parsed.data;
}

export function parseCreateAdminVideoInput(
  payload: unknown,
): CreateAdminVideoInput {
  const parsed = createAdminVideoSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid admin video create payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function parseUpdateAdminVideoInput(
  payload: unknown,
): UpdateAdminVideoInput {
  const parsed = updateAdminVideoSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid admin video update payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function parseListAdminVideosQuery(
  payload: unknown,
): ListAdminVideosQuery {
  const parsed = listAdminVideosQuerySchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid admin video list query.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}
