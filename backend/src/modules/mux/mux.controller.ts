import {
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  BearerAuthGuard,
  type AuthenticatedRequest,
} from '../auth/bearer-auth.guard';
import { parseCreateMuxDirectUploadInput } from './mux.schemas';
import { MuxService } from './mux.service';

type MuxWebhookRequest = Request & {
  rawBody?: Buffer;
};

@Controller('v1/mux')
export class MuxController {
  constructor(private readonly muxService: MuxService) {}

  @UseGuards(BearerAuthGuard)
  @Post('uploads')
  async createDirectUpload(
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const parsedInput = parseCreateMuxDirectUploadInput(payload);

    return {
      data: await this.muxService.createDirectUpload(
        request.authUser.id,
        parsedInput,
      ),
    };
  }

  @HttpCode(200)
  @Post('webhooks')
  async handleWebhook(
    @Headers('mux-signature') muxSignatureHeader: string | undefined,
    @Body() payload: unknown,
    @Req() request: MuxWebhookRequest,
  ) {
    const rawBody = request.rawBody
      ? request.rawBody.toString('utf8')
      : typeof payload === 'string'
        ? payload
        : JSON.stringify(payload ?? {});

    return {
      data: await this.muxService.handleWebhook(
        muxSignatureHeader,
        rawBody,
        payload,
      ),
    };
  }
}
