import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

const birthdateSchema = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Birthdate must be in YYYY-MM-DD format.')
  .refine((value) => !Number.isNaN(Date.parse(`${value}T00:00:00Z`)), {
    message: 'Birthdate is invalid.',
  })
  .refine((value) => new Date(`${value}T00:00:00Z`) <= new Date(), {
    message: 'Birthdate cannot be in the future.',
  });

const ageGateSchema = z.object({
  birthdate: birthdateSchema,
  countryCode: z
    .string()
    .trim()
    .length(2, 'Country code must be exactly 2 characters.')
    .transform((value) => value.toUpperCase()),
});

const parentalAttestationSchema = z.object({
  parentEmail: z
    .string()
    .trim()
    .email('Enter a valid parent email address.')
    .max(320)
    .transform((value) => value.toLowerCase()),
  parentFullName: z
    .string()
    .trim()
    .min(3, 'Parent full name must be at least 3 characters.')
    .max(120, 'Parent full name must be at most 120 characters.'),
  relationshipToChild: z
    .string()
    .trim()
    .min(2, 'Relationship must be at least 2 characters.')
    .max(60, 'Relationship must be at most 60 characters.'),
  attestationAccepted: z.boolean().refine((value) => value, {
    message: 'Parental attestation must be accepted.',
  }),
});

export type AgeGateInput = z.infer<typeof ageGateSchema>;
export type ParentalAttestationInput = z.infer<
  typeof parentalAttestationSchema
>;

export function parseAgeGateInput(payload: unknown): AgeGateInput {
  const parsed = ageGateSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid age-gate payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function parseParentalAttestationInput(
  payload: unknown,
): ParentalAttestationInput {
  const parsed = parentalAttestationSchema.safeParse(payload);

  if (!parsed.success) {
    throw new BadRequestException({
      message: 'Invalid parental attestation payload.',
      errors: parsed.error.flatten().fieldErrors,
    });
  }

  return parsed.data;
}

export function calculateAgeInYears(
  birthdate: Date,
  asOf: Date = new Date(),
): number {
  let age = asOf.getUTCFullYear() - birthdate.getUTCFullYear();

  const hasHadBirthdayThisYear =
    asOf.getUTCMonth() > birthdate.getUTCMonth() ||
    (asOf.getUTCMonth() === birthdate.getUTCMonth() &&
      asOf.getUTCDate() >= birthdate.getUTCDate());

  if (!hasHadBirthdayThisYear) {
    age -= 1;
  }

  return age;
}
