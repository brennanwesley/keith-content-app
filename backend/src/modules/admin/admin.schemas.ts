import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { contentTypeIdSchema } from '../content/content-id.schema';

const databaseUuidRegex =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const videoStatusSchema = z.enum([
  'draft',
  'processing',
  'ready',
  'blocked',
  'archived',
]);

const videoIdSchema = z.string().uuid('Video ID must be a valid UUID.');
const contentTagIdSchema = z
  .string()
  .regex(databaseUuidRegex, 'Content tag ID must be a valid UUID.');

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
  contentTagIds: z
    .array(contentTagIdSchema)
    .max(50, 'You can assign up to 50 content tags to one video.')
    .default([])
    .transform((contentTagIds) => Array.from(new Set(contentTagIds))),
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
    contentTagIds: z
      .array(contentTagIdSchema)
      .max(50, 'You can assign up to 50 content tags to one video.')
      .optional()
      .transform((contentTagIds) => {
        if (!contentTagIds) {
          return undefined;
        }

        return Array.from(new Set(contentTagIds));
      }),
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
      value.contentTagIds === undefined &&
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

const createAdminContentTagSchema = z.object({
  name: z
    .string()
    .trim()
    .min(2, 'Content tag name must be at least 2 characters.')
    .max(80, 'Content tag name must be at most 80 characters.'),
  description: z
    .string()
    .trim()
    .max(500, 'Content tag description must be at most 500 characters.')
    .optional()
    .default(''),
});

const updateAdminContentTagSchema = z
  .object({
    name: z
      .string()
      .trim()
      .min(2, 'Content tag name must be at least 2 characters.')
      .max(80, 'Content tag name must be at most 80 characters.')
      .optional(),
    description: z
      .string()
      .trim()
      .max(500, 'Content tag description must be at most 500 characters.')
      .nullable()
      .optional(),
  })
  .superRefine((value, context) => {
    if (value.name === undefined && value.description === undefined) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'Provide at least one field to update.',
      });
    }
  });

export type CreateAdminVideoInput = z.infer<typeof createAdminVideoSchema>;
export type UpdateAdminVideoInput = z.infer<typeof updateAdminVideoSchema>;
export type ListAdminVideosQuery = z.infer<typeof listAdminVideosQuerySchema>;
export type VideoStatus = z.infer<typeof videoStatusSchema>;
export type CreateAdminContentTagInput = z.infer<
  typeof createAdminContentTagSchema
>;
export type UpdateAdminContentTagInput = z.infer<
  typeof updateAdminContentTagSchema
>;

export function parseVideoId(rawValue: unknown): string {
  const parsed = videoIdSchema.safeParse(rawValue);

  if (!parsed.success) {
    throw new BadRequestException('Video ID was invalid.');
  }

  return parsed.data;
}

export function parseCreateAdminContentTagInput(
  payload: unknown,
): CreateAdminContentTagInput {
  const parsed = createAdminContentTagSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid admin content tag create payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function parseUpdateAdminContentTagInput(
  payload: unknown,
): UpdateAdminContentTagInput {
  const parsed = updateAdminContentTagSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid admin content tag update payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function parseContentTagId(rawValue: unknown): string {
  const parsed = contentTagIdSchema.safeParse(rawValue);

  if (!parsed.success) {
    throw new BadRequestException('Content tag ID was invalid.');
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
