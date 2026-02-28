import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import type { Request } from 'express';
import { SupabaseService } from '../supabase/supabase.service';

export type AuthenticatedRequest = Request & {
  authUser: {
    id: string;
    email: string | null;
  };
};

@Injectable()
export class BearerAuthGuard implements CanActivate {
  constructor(private readonly supabaseService: SupabaseService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const rawAuthorizationHeader = request.headers.authorization;
    const authorizationHeader =
      typeof rawAuthorizationHeader === 'string'
        ? rawAuthorizationHeader
        : Array.isArray(rawAuthorizationHeader)
          ? rawAuthorizationHeader[0]
          : undefined;
    const token = this.extractBearerToken(authorizationHeader);

    if (!token) {
      throw new UnauthorizedException('Missing bearer access token.');
    }

    const client = this.getClientOrThrow();
    const { data, error } = await client.auth.getUser(token);

    if (error || !data.user) {
      throw new UnauthorizedException('Invalid or expired access token.');
    }

    request.authUser = {
      id: data.user.id,
      email: data.user.email ?? null,
    };

    return true;
  }

  private extractBearerToken(headerValue: string | undefined): string | null {
    if (!headerValue) {
      return null;
    }

    const [tokenType, tokenValue] = headerValue.trim().split(/\s+/, 2);

    if (!tokenType || tokenType.toLowerCase() !== 'bearer' || !tokenValue) {
      return null;
    }

    return tokenValue;
  }

  private getClientOrThrow() {
    try {
      return this.supabaseService.getServiceClient();
    } catch {
      throw new ServiceUnavailableException(
        'Authentication service is not configured yet. Set backend Supabase credentials.',
      );
    }
  }
}
