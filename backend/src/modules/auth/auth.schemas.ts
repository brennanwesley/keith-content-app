import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const passwordSchema = z
  .string()
  .min(10, 'Password must be at least 10 characters.')
  .max(128, 'Password must be at most 128 characters.')
  .regex(/[A-Z]/, 'Password must include at least one uppercase letter.')
  .regex(/[a-z]/, 'Password must include at least one lowercase letter.')
  .regex(/[0-9]/, 'Password must include at least one number.');

const signupSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(320)
    .transform((value) => value.toLowerCase()),
  username: z
    .string()
    .trim()
    .min(3, 'Username must be at least 3 characters.')
    .max(32, 'Username must be at most 32 characters.')
    .regex(
      /^[a-zA-Z0-9_]+$/,
      'Username can contain only letters, numbers, and underscores.',
    ),
  password: passwordSchema,
});

const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email('Enter a valid email address.')
    .max(320)
    .transform((value) => value.toLowerCase()),
  password: z.string().min(1, 'Password is required.').max(128),
});

const changeEmailSchema = z
  .object({
    userId: z.string().uuid('Invalid user ID.'),
    currentEmail: z
      .string()
      .trim()
      .email('Enter a valid current email address.')
      .max(320)
      .transform((value) => value.toLowerCase()),
    newEmail: z
      .string()
      .trim()
      .email('Enter a valid new email address.')
      .max(320)
      .transform((value) => value.toLowerCase()),
    password: z.string().min(1, 'Password is required.').max(128),
  })
  .refine((value) => value.currentEmail !== value.newEmail, {
    message: 'New email must be different from current email.',
    path: ['newEmail'],
  });

export type SignupInput = z.infer<typeof signupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ChangeEmailInput = z.infer<typeof changeEmailSchema>;

export function parseSignupInput(payload: unknown): SignupInput {
  const parsed = signupSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid signup payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function parseChangeEmailInput(payload: unknown): ChangeEmailInput {
  const parsed = changeEmailSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid change-email payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function parseLoginInput(payload: unknown): LoginInput {
  const parsed = loginSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid login payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}
