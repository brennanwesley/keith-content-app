import { Module } from '@nestjs/common';
import { BearerAuthGuard } from '../auth/bearer-auth.guard';
import { ContentModule } from '../content/content.module';
import { ParentController } from './parent.controller';
import { ParentService } from './parent.service';

@Module({
  imports: [ContentModule],
  controllers: [ParentController],
  providers: [ParentService, BearerAuthGuard],
  exports: [ParentService],
})
export class ParentModule {}
