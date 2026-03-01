import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';
import {
  BearerAuthGuard,
  type AuthenticatedRequest,
} from '../auth/bearer-auth.guard';
import {
  parseCreateAdminVideoInput,
  parseListAdminVideosQuery,
  parseUpdateAdminVideoInput,
  parseVideoId,
} from './admin.schemas';
import { AdminService } from './admin.service';

@Controller('v1/admin/videos')
export class AdminController {
  constructor(private readonly adminService: AdminService) {}

  @UseGuards(BearerAuthGuard)
  @Get()
  async listVideos(
    @Query() query: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsedQuery = parseListAdminVideosQuery(query);

    return {
      data: await this.adminService.listVideos(
        request.authUser.id,
        parsedQuery,
      ),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Get(':videoId')
  async getVideo(
    @Param('videoId') rawVideoId: string,
    @Req() request: AuthenticatedRequest,
  ) {
    const videoId = parseVideoId(rawVideoId);

    return {
      data: await this.adminService.getVideoById(request.authUser.id, videoId),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Post()
  async createVideo(
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = parseCreateAdminVideoInput(payload);

    return {
      data: await this.adminService.createVideo(request.authUser.id, input),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Put(':videoId')
  async updateVideo(
    @Param('videoId') rawVideoId: string,
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const videoId = parseVideoId(rawVideoId);
    const input = parseUpdateAdminVideoInput(payload);

    return {
      data: await this.adminService.updateVideo(
        request.authUser.id,
        videoId,
        input,
      ),
    };
  }
}
