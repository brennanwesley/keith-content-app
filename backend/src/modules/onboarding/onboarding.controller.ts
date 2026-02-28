import { Body, Controller, Post } from '@nestjs/common';
import type { Request } from 'express';
import { Req } from '@nestjs/common';
import {
  parseAgeGateInput,
  parseParentalAttestationInput,
  type AgeGateInput,
  type ParentalAttestationInput,
} from './onboarding.schemas';
import { OnboardingService } from './onboarding.service';

@Controller('v1/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @Post('age-gate')
  async submitAgeGate(@Body() payload: unknown) {
    const input: AgeGateInput = parseAgeGateInput(payload);

    return {
      data: await this.onboardingService.submitAgeGate(input),
    };
  }

  @Post('parental-attestation')
  async submitParentalAttestation(
    @Body() payload: unknown,
    @Req() request: Request,
  ) {
    const input: ParentalAttestationInput =
      parseParentalAttestationInput(payload);
    const forwardedForHeader = request.headers['x-forwarded-for'];
    const forwardedForIp =
      typeof forwardedForHeader === 'string'
        ? (forwardedForHeader.split(',')[0]?.trim() ?? null)
        : null;
    const ipAddress =
      forwardedForIp ?? request.ip ?? request.socket.remoteAddress ?? null;
    const userAgentHeader = request.headers['user-agent'];
    const userAgent =
      typeof userAgentHeader === 'string' ? userAgentHeader : null;

    return {
      data: await this.onboardingService.submitParentalAttestation(input, {
        ipAddress,
        userAgent,
      }),
    };
  }
}
