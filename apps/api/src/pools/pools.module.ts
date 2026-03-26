import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { PoolsService } from './pools.service';
import { PoolsController } from './pools.controller';
import { PoolsGateway } from './pools.gateway';
import { QuestionsModule } from '../questions/questions.module';
import { ModerationModule } from '../moderation/moderation.module';
import { PollsModule } from '../polls/polls.module';

@Module({
  imports: [
    QuestionsModule,
    ModerationModule,
    PollsModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'default-secret'),
      }),
    }),
  ],
  providers: [PoolsService, PoolsGateway],
  controllers: [PoolsController],
  exports: [PoolsService, PoolsGateway],
})
export class PoolsModule {}
