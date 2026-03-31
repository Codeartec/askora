import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule, ConfigService } from '@nestjs/config';
import type { StringValue } from 'ms';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { GoogleStrategy } from './strategies/google.strategy';
import { UsersModule } from '../users/users.module';

function parseJwtExpiresIn(raw: unknown): StringValue | number | undefined {
  if (typeof raw !== 'string') return undefined;
  const trimmed = raw.trim();
  if (!trimmed) return undefined;

  // Allow env values like: "86400 # 24 hours" or "86400 #24*60*60"
  const withoutComment = trimmed.split('#', 1)[0]?.trim() ?? '';
  if (!withoutComment) return undefined;

  // If it's a plain integer, pass number (seconds).
  if (/^\d+$/.test(withoutComment)) return Number.parseInt(withoutComment, 10);

  // Otherwise, pass through strings like "7d", "24h", "15m" (jsonwebtoken/ms syntax).
  // Reject values with whitespace to avoid subtle parsing issues.
  if (/\s/.test(withoutComment)) return undefined;
  return withoutComment as StringValue;
}

const DEFAULT_JWT_EXPIRES_IN: StringValue = '7d';

@Module({
  imports: [
    UsersModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get('JWT_SECRET', 'default-secret'),
        signOptions: {
          expiresIn:
            parseJwtExpiresIn(config.get<string>('JWT_EXPIRES_IN')) ??
            parseJwtExpiresIn(process.env.JWT_EXPIRES_IN) ??
            DEFAULT_JWT_EXPIRES_IN,
        },
      }),
    }),
  ],
  providers: [AuthService, JwtStrategy, GoogleStrategy],
  controllers: [AuthController],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
