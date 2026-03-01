import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  BearerAuthGuard,
  type AuthenticatedRequest,
} from '../auth/bearer-auth.guard';
import {
  parseChildUserId,
  parseParentLinkId,
  parseRequestParentLinkInput,
  parseUpdateChildContentRestrictionsInput,
} from './parent.schemas';
import { ParentService } from './parent.service';

@Controller('v1/parent')
export class ParentController {
  constructor(private readonly parentService: ParentService) {}

  @UseGuards(BearerAuthGuard)
  @Get('links')
  async listMyLinks(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.parentService.listMyLinks(request.authUser.id),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Post('links/request')
  async requestLink(
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = parseRequestParentLinkInput(payload);

    return {
      data: await this.parentService.requestLinkByChildUsername(
        request.authUser.id,
        input.childUsername,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Post('links/:linkId/accept')
  async acceptLink(
    @Param('linkId') rawLinkId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const linkId = parseParentLinkId(rawLinkId);

    return {
      data: await this.parentService.acceptLinkById(
        request.authUser.id,
        linkId,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Post('links/:linkId/revoke')
  async revokeLink(
    @Param('linkId') rawLinkId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const linkId = parseParentLinkId(rawLinkId);

    return {
      data: await this.parentService.revokeLinkById(
        request.authUser.id,
        linkId,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Get('children/:childUserId/content-restrictions')
  async getChildContentRestrictions(
    @Param('childUserId') rawChildUserId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const childUserId = parseChildUserId(rawChildUserId);

    return {
      data: await this.parentService.getChildContentRestrictions(
        request.authUser.id,
        childUserId,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Put('children/:childUserId/content-restrictions')
  async updateChildContentRestrictions(
    @Param('childUserId') rawChildUserId: string,
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const childUserId = parseChildUserId(rawChildUserId);
    const input = parseUpdateChildContentRestrictionsInput(payload);

    return {
      data: await this.parentService.replaceChildContentRestrictions(
        request.authUser.id,
        childUserId,
        input,
      ),
    };
  }
}
