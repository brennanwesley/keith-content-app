import { z } from 'zod';

// Postgres UUID values are valid as 8-4-4-4-12 hex groups and may not always
// match RFC variant/version constraints enforced by z.string().uuid().
const DATABASE_UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export const contentTypeIdSchema = z
  .string()
  .regex(DATABASE_UUID_REGEX, 'Each content type ID must be a valid UUID.');
