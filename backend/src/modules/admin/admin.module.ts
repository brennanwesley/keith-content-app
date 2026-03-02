import { Module } from '@nestjs/common';
import { AdminContentTagsController } from './admin-content-tags.controller';
import { AdminController } from './admin.controller';
import { AdminService } from './admin.service';

@Module({
  controllers: [AdminController, AdminContentTagsController],
  providers: [AdminService],
})
export class AdminModule {}
