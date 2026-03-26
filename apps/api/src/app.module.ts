import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from './prisma/prisma.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { PoolsModule } from './pools/pools.module';
import { QuestionsModule } from './questions/questions.module';
import { LlmModule } from './llm/llm.module';
import { ModerationModule } from './moderation/moderation.module';
import { PollsModule } from './polls/polls.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    AuthModule,
    UsersModule,
    PoolsModule,
    QuestionsModule,
    LlmModule,
    ModerationModule,
    PollsModule,
  ],
})
export class AppModule {}
