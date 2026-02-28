import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const updateMyContentPreferencesSchema = z.object({
  contentTypeIds: z
    .array(z.string().uuid('Each content type ID must be a valid UUID.'))
    .max(25, 'You can select up to 25 content types.')
    .default([])
    .transform((value) => Array.from(new Set(value))),
});

export type UpdateMyContentPreferencesInput = z.infer<
  typeof updateMyContentPreferencesSchema
>;

export function parseUpdateMyContentPreferencesInput(
  payload: unknown,
): UpdateMyContentPreferencesInput {
  const parsed = updateMyContentPreferencesSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid content preferences payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}
