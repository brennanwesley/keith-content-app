import { Module } from '@nestjs/common';
import { BearerAuthGuard } from '../auth/bearer-auth.guard';
import { OnboardingController } from './onboarding.controller';
import { OnboardingService } from './onboarding.service';

@Module({
  controllers: [OnboardingController],
  providers: [OnboardingService, BearerAuthGuard],
  exports: [OnboardingService],
})
export class OnboardingModule {}
