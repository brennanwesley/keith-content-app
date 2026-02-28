import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import { AuthService } from './auth.service';
import {
  BearerAuthGuard,
  type AuthenticatedRequest,
} from './bearer-auth.guard';
import {
  parseChangeEmailInput,
  parseLoginInput,
  parseSignupInput,
} from './auth.schemas';

@Controller('v1/auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  async signup(@Body() payload: unknown) {
    const input = parseSignupInput(payload);

    return {
      data: await this.authService.signup(input),
    };
  }

  @Post('login')
  async login(@Body() payload: unknown) {
    const input = parseLoginInput(payload);

    return {
      data: await this.authService.login(input),
    };
  }

  @UseGuards(BearerAuthGuard)
  @Post('change-email')
  async changeEmail(
    @Body() payload: unknown,
    @Req() request: AuthenticatedRequest,
  ) {
    const input = parseChangeEmailInput(payload);
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
      data: await this.authService.changeEmail(request.authUser.id, input, {
        ipAddress,
        userAgent,
      }),
    };
  }
}
