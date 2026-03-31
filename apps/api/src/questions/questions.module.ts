import { Module } from '@nestjs/common';
import { QuestionsService } from './questions.service';
import { MergeService } from './merge.service';
import { QuestionSimilarityService } from './question-similarity.service';

@Module({
  providers: [QuestionsService, MergeService, QuestionSimilarityService],
  exports: [QuestionsService, MergeService, QuestionSimilarityService],
})
export class QuestionsModule {}
