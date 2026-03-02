import { Body, Controller, Get, Put, Req, UseGuards } from '@nestjs/common';
import {
  BearerAuthGuard,
  type AuthenticatedRequest,
} from '../auth/bearer-auth.guard';
import {
  parseUpdateMyContentPreferencesInput,
  type UpdateMyContentPreferencesInput,
} from './content.schemas';
import { ContentService } from './content.service';

@Controller('v1')
export class ContentController {
  constructor(private readonly contentService: ContentService) {}

  @Get('content-types')
  async listContentTypes() {
    return {
      data: await this.contentService.listContentTypes(),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Get('me/content-preferences')
  async getMyContentPreferences(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.contentService.getMyContentPreferences(
        request.authUser.id,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Get('me/effective-content-preferences')
  async getMyEffectiveContentPreferences(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.contentService.getEffectiveContentPreferences(
        request.authUser.id,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Get('feed/catalog')
  async getFeedCatalog(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.contentService.getFeedCatalog(request.authUser.id),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Put('me/content-preferences')
  async updateMyContentPreferences(
    @Req() request: AuthenticatedRequest,
    @Body() payload: unknown,
  ) {
    const input: UpdateMyContentPreferencesInput =
      parseUpdateMyContentPreferencesInput(payload);

    return {
      data: await this.contentService.replaceMyContentPreferences(
        request.authUser.id,
        input,
      ),
    };
  }
}
