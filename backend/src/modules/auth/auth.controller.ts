import { Body, Controller, Post } from '@nestjs/common';
import { AuthService } from './auth.service';
import { parseLoginInput, parseSignupInput } from './auth.schemas';

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
}
