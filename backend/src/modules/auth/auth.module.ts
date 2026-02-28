import { Module } from '@nestjs/common';
import { BearerAuthGuard } from './bearer-auth.guard';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

@Module({
  controllers: [AuthController],
  providers: [AuthService, BearerAuthGuard],
  exports: [AuthService],
})
export class AuthModule {}
