import { Module } from '@nestjs/common';
import { PollsService } from './polls.service';

@Module({
  providers: [PollsService],
  exports: [PollsService],
})
export class PollsModule {}
