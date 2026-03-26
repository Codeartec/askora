import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(private readonly configService: ConfigService) {
    super({
      clientID: configService.get('GOOGLE_CLIENT_ID', 'not-set'),
      clientSecret: configService.get('GOOGLE_CLIENT_SECRET', 'not-set'),
      callbackURL: configService.get('GOOGLE_CALLBACK_URL', 'http://localhost:3001/api/auth/google/callback'),
      scope: ['email', 'profile'],
    });
  }

  private splitName(displayName?: string): { firstName: string; lastName: string } {
    const parts = (displayName || '').trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0) return { firstName: '', lastName: '' };
    if (parts.length === 1) return { firstName: parts[0], lastName: '' };
    return { firstName: parts[0], lastName: parts.slice(1).join(' ') };
  }

  async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback) {
    const { firstName, lastName } = profile?.name?.givenName || profile?.name?.familyName
      ? { firstName: profile?.name?.givenName || '', lastName: profile?.name?.familyName || '' }
      : this.splitName(profile?.displayName);

    const user = {
      googleId: profile.id,
      email: profile.emails[0].value,
      name: profile.displayName,
      firstName,
      lastName,
      avatarUrl: profile.photos?.[0]?.value,
    };
    done(null, user);
  }
}
