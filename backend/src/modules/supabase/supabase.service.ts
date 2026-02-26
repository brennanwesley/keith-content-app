import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

@Injectable()
export class SupabaseService {
  private client: SupabaseClient | null = null;

  constructor(private readonly configService: ConfigService) {}

  isConfigured(): boolean {
    return Boolean(
      this.configService.get<string>('SUPABASE_URL') &&
      this.configService.get<string>('SUPABASE_SERVICE_ROLE_KEY'),
    );
  }

  getServiceClient(): SupabaseClient {
    if (this.client) {
      return this.client;
    }

    const supabaseUrl = this.configService.get<string>('SUPABASE_URL');
    const supabaseServiceRoleKey = this.configService.get<string>(
      'SUPABASE_SERVICE_ROLE_KEY',
    );

    if (!supabaseUrl || !supabaseServiceRoleKey) {
      throw new Error(
        'Supabase service credentials are missing. Configure SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.',
      );
    }

    this.client = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });

    return this.client;
  }
}
