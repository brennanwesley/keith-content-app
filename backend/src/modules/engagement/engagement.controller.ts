import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import {
  BearerAuthGuard,
  type AuthenticatedRequest,
} from '../auth/bearer-auth.guard';
import { EngagementService } from './engagement.service';
import { parseTrackWatchEventInput } from './engagement.schemas';

@Controller('v1/engagement')
export class EngagementController {
  constructor(private readonly engagementService: EngagementService) {}

  @UseGuards(BearerAuthGuard)
  @Post('watch-events')
  async trackWatchEvent(
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = parseTrackWatchEventInput(payload);

    return {
      data: await this.engagementService.trackWatchEvent(
        request.authUser.id,
        input,
      ),
    };
  }
}
