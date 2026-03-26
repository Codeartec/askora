import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { MergeService } from './merge.service';

@Module({
  providers: [QuestionsService, MergeService],
  exports: [QuestionsService, MergeService],
})
export class QuestionsModule {}
