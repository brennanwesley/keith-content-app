import { Module } from '@nestjs/common';
import { MuxController } from './mux.controller';
import { MuxService } from './mux.service';

@Module({
  controllers: [MuxController],
  providers: [MuxService],
})
export class MuxModule {}
