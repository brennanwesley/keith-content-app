import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';
import { contentTypeIdSchema } from '../content/content-id.schema';

const childUsernameSchema = z
  .string()
  .trim()
  .min(3, 'Child username must be at least 3 characters.')
  .max(32, 'Child username must be at most 32 characters.')
  .regex(
    /^[a-zA-Z0-9_]+$/,
    'Child username can contain only letters, numbers, and underscores.',
  );

const parentLinkIdSchema = z
  .string()
  .uuid('Parent link ID must be a valid UUID.');
const childUserIdSchema = z
  .string()
  .uuid('Child user ID must be a valid UUID.');

const requestParentLinkSchema = z.object({
  childUsername: childUsernameSchema,
});

const updateChildContentRestrictionsSchema = z.object({
  blockedContentTypeIds: z
    .array(contentTypeIdSchema)
    .max(25, 'You can restrict up to 25 content types at once.')
    .default([])
    .transform((contentTypeIds) => Array.from(new Set(contentTypeIds))),
});

export type RequestParentLinkInput = z.infer<typeof requestParentLinkSchema>;
export type UpdateChildContentRestrictionsInput = z.infer<
  typeof updateChildContentRestrictionsSchema
>;

export function parseRequestParentLinkInput(
  payload: unknown,
): RequestParentLinkInput {
  const parsed = requestParentLinkSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid parent-link request payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function parseParentLinkId(rawValue: unknown): string {
  const parsed = parentLinkIdSchema.safeParse(rawValue);

  if (!parsed.success) {
    throw new BadRequestException('Parent link ID was invalid.');
  }

  return parsed.data;
}

export function parseChildUserId(rawValue: unknown): string {
  const parsed = childUserIdSchema.safeParse(rawValue);

  if (!parsed.success) {
    throw new BadRequestException('Child user ID was invalid.');
  }

  return parsed.data;
}

export function parseUpdateChildContentRestrictionsInput(
  payload: unknown,
): UpdateChildContentRestrictionsInput {
  const parsed = updateChildContentRestrictionsSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid child content restriction payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}
