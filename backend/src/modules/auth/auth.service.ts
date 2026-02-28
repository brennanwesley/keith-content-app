import {
  ConflictException,
  Injectable,
  InternalServerErrorException,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service';
import type { LoginInput, SignupInput } from './auth.schemas';

export type SignupResult = {
  userId: string;
  email: string;
  requiresEmailVerification: boolean;
};

export type LoginResult = {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  user: {
    id: string;
    email: string;
    emailVerified: boolean;
  };
};

@Injectable()
export class AuthService {
  constructor(private readonly supabaseService: SupabaseService) {}

  async signup(input: SignupInput): Promise<SignupResult> {
    const client = this.getClientOrThrow();

    const { data: createdUser, error: createUserError } =
      await client.auth.admin.createUser({
        email: input.email,
        password: input.password,
        email_confirm: false,
      });

    if (createUserError) {
      if (this.isEmailTakenError(createUserError.message)) {
        throw new ConflictException('Email is already registered.');
      }

      throw new InternalServerErrorException('Failed to create account.');
    }

    const userId = createdUser.user?.id;

    if (!userId) {
      throw new InternalServerErrorException(
        'Auth provider did not return a user ID.',
      );
    }

    const { error: profileInsertError } = await client.from('profiles').insert({
      id: userId,
      username: input.username,
      display_name: input.username,
      account_type: 'learner',
    });

    if (profileInsertError) {
      await client.auth.admin.deleteUser(userId);

      if (profileInsertError.code === '23505') {
        throw new ConflictException('Username is already taken.');
      }

      throw new InternalServerErrorException('Failed to finish account setup.');
    }

    return {
      userId,
      email: input.email,
      requiresEmailVerification: true,
    };
  }

  async login(input: LoginInput): Promise<LoginResult> {
    const client = this.getClientOrThrow();

    const { data, error } = await client.auth.signInWithPassword({
      email: input.email,
      password: input.password,
    });

    if (error || !data.session || !data.user) {
      throw new UnauthorizedException('Invalid email or password.');
    }

    return {
      accessToken: data.session.access_token,
      refreshToken: data.session.refresh_token,
      expiresIn: data.session.expires_in,
      tokenType: data.session.token_type,
      user: {
        id: data.user.id,
        email: data.user.email ?? input.email,
        emailVerified: Boolean(data.user.email_confirmed_at),
      },
    };
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

  private isEmailTakenError(message: string): boolean {
    return (
      message.toLowerCase().includes('already been registered') ||
      message.toLowerCase().includes('already registered') ||
      message.toLowerCase().includes('already exists')
    );
  }
}
