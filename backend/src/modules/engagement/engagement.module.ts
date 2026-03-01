import { Module } from '@nestjs/common';
import { BearerAuthGuard } from '../auth/bearer-auth.guard';
import { EngagementController } from './engagement.controller';
import { EngagementService } from './engagement.service';

@Module({
  controllers: [EngagementController],
  providers: [EngagementService, BearerAuthGuard],
  exports: [EngagementService],
})
export class EngagementModule {}
