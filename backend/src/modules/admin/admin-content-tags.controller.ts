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
  parseContentTagId,
  parseCreateAdminContentTagInput,
  parseUpdateAdminContentTagInput,
} from './admin.schemas';
import { AdminService } from './admin.service';

@Controller('v1/admin/content-tags')
export class AdminContentTagsController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(BearerAuthGuard)
  @Get()
  async listContentTags(@Req() request: AuthenticatedRequest) {
    return {
      data: await this.adminService.listContentTags(request.authUser.id),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Post()
  async createContentTag(
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = parseCreateAdminContentTagInput(payload);

    return {
      data: await this.adminService.createContentTag(
        request.authUser.id,
        input,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Put(':contentTagId')
  async updateContentTag(
    @Param('contentTagId') rawContentTagId: string,
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const contentTagId = parseContentTagId(rawContentTagId);
    const input = parseUpdateAdminContentTagInput(payload);

    return {
      data: await this.adminService.updateContentTag(
        request.authUser.id,
        contentTagId,
        input,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Put(':contentTagId/archive')
  async archiveContentTag(
    @Param('contentTagId') rawContentTagId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const contentTagId = parseContentTagId(rawContentTagId);

    return {
      data: await this.adminService.archiveContentTag(
        request.authUser.id,
        contentTagId,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Put(':contentTagId/unarchive')
  async unarchiveContentTag(
    @Param('contentTagId') rawContentTagId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const contentTagId = parseContentTagId(rawContentTagId);

    return {
      data: await this.adminService.unarchiveContentTag(
        request.authUser.id,
        contentTagId,
      ),
    };
  }
}
