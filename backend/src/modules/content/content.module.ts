import { Module } from '@nestjs/common';
import { BearerAuthGuard } from '../auth/bearer-auth.guard';
import { ContentController } from './content.controller';
import { ContentService } from './content.service';

@Module({
  controllers: [ContentController],
  providers: [ContentService, BearerAuthGuard],
  exports: [ContentService],
})
export class ContentModule {}
