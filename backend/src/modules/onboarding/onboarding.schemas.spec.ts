import { BadRequestException } from '@nestjs/common';
import {
  calculateAgeInYears,
  parseAgeGateInput,
  parseParentalAttestationInput,
} from './onboarding.schemas';

describe('onboarding schemas', () => {
  it('accepts valid age-gate payload and normalizes country code', () => {
    const parsed = parseAgeGateInput({
      birthdate: '2014-05-01',
      countryCode: 'us',
    });

    expect(parsed).toEqual({
      birthdate: '2014-05-01',
      countryCode: 'US',
    });
  });

  it('rejects future birthdate', () => {
    expect(() =>
      parseAgeGateInput({
        birthdate: '2999-01-01',
        countryCode: 'US',
      }),
    ).toThrow(BadRequestException);
  });

  it('calculates age correctly around birthday boundaries', () => {
    const birthdate = new Date('2013-03-01T00:00:00Z');

    expect(
      calculateAgeInYears(birthdate, new Date('2026-02-28T00:00:00Z')),
    ).toBe(12);
    expect(
      calculateAgeInYears(birthdate, new Date('2026-03-01T00:00:00Z')),
    ).toBe(13);
  });

  it('accepts parental attestation payload and normalizes parent email', () => {
    const parsed = parseParentalAttestationInput({
      parentEmail: 'Parent@example.com',
      parentFullName: 'Jamie Carter',
      relationshipToChild: 'Mother',
      attestationAccepted: true,
    });

    expect(parsed).toEqual({
      parentEmail: 'parent@example.com',
      parentFullName: 'Jamie Carter',
      relationshipToChild: 'Mother',
      attestationAccepted: true,
    });
  });

  it('rejects parental attestation payload if checkbox is not accepted', () => {
    expect(() =>
      parseParentalAttestationInput({
        parentEmail: 'parent@example.com',
        parentFullName: 'Jamie Carter',
        relationshipToChild: 'Mother',
        attestationAccepted: false,
      }),
    ).toThrow(BadRequestException);
  });
});
