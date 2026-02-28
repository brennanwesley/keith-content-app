import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { validateEnv } from './config/env.schema';
import { AdminModule } from './modules/admin/admin.module';
import { AuthModule } from './modules/auth/auth.module';
import { BillingModule } from './modules/billing/billing.module';
import { ContentModule } from './modules/content/content.module';
import { EngagementModule } from './modules/engagement/engagement.module';
import { HistoryModule } from './modules/history/history.module';
import { MuxModule } from './modules/mux/mux.module';
import { OnboardingModule } from './modules/onboarding/onboarding.module';
import { ParentModule } from './modules/parent/parent.module';
import { ProfilesModule } from './modules/profiles/profiles.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    SupabaseModule,
    AuthModule,
    UsersModule,
    ProfilesModule,
    OnboardingModule,
    ContentModule,
    EngagementModule,
    HistoryModule,
    ParentModule,
    AdminModule,
    BillingModule,
    MuxModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
