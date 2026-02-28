import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  BearerAuthGuard,
  type AuthenticatedRequest,
} from '../auth/bearer-auth.guard';
import {
  parseAgeGateInput,
  parseParentalAttestationInput,
} from './onboarding.schemas';
import { OnboardingService } from './onboarding.service';

@Controller('v1/onboarding')
export class OnboardingController {
  constructor(private readonly onboardingService: OnboardingService) {}

  @UseGuards(BearerAuthGuard)
  @Post('age-gate')
  async submitAgeGate(
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = parseAgeGateInput(payload);

    return {
      data: await this.onboardingService.submitAgeGate(
        request.authUser.id,
        input,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Post('parental-attestation')
  async submitParentalAttestation(
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = parseParentalAttestationInput(payload);
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
      data: await this.onboardingService.submitParentalAttestation(
        request.authUser.id,
        input,
        {
          ipAddress,
          userAgent,
        },
      ),
    };
  }
}
