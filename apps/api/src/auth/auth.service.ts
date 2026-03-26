import { Injectable, UnauthorizedException, ConflictException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { UsersService } from '../users/users.service';
import { Prisma } from '@prisma/client';
import sharp from 'sharp';

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;
const ACCEPTED_AVATAR_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp']);

@Injectable()
export class AuthService {
  constructor(
    private readonly usersService: UsersService,
    private readonly jwtService: JwtService,
  ) {}

  private async normalizeAvatarFromBuffer(input: { buffer: Buffer; mime: string }) {
    if (!ACCEPTED_AVATAR_MIMES.has(input.mime)) return null;
    if (input.buffer.byteLength > MAX_AVATAR_BYTES) return null;

    const webp = await sharp(input.buffer)
      .rotate()
      .resize(256, 256, { fit: 'cover' })
      .webp({ quality: 80 })
      .toBuffer();

    return {
      avatarData: Uint8Array.from(webp),
      avatarMime: 'image/webp',
      avatarUpdatedAt: new Date(),
    };
  }

  private avatarDataUrl(user: any) {
    const data: Uint8Array | undefined = user?.avatarData ?? undefined;
    const mime: string | undefined = user?.avatarMime ?? undefined;
    if (!data || !mime) return undefined;
    return `data:${mime};base64,${Buffer.from(data).toString('base64')}`;
  }

  toPublicUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      firstName: user.firstName,
      lastName: user.lastName,
      avatarUrl: this.avatarDataUrl(user) || user.avatarUrl || undefined,
      hasPassword: Boolean(user.passwordHash),
    };
  }

  async register(
    email: string,
    password: string,
    firstName: string,
    lastName: string,
    avatar?: { buffer: Buffer; mime: string },
  ) {
    const existing = await this.usersService.findByEmail(email);
    if (existing) throw new ConflictException('Email already registered');

    const passwordHash = await bcrypt.hash(password, 10);
    const name = `${firstName} ${lastName}`.trim();
    const normalized = avatar ? await this.normalizeAvatarFromBuffer(avatar) : null;
    const createData: any = { email, name, firstName, lastName, passwordHash };
    if (normalized) Object.assign(createData, normalized);
    const user = await this.usersService.create(createData);
    return this.buildAuthResponse(user);
  }

  async login(email: string, password: string) {
    const user = await this.usersService.findByEmail(email);
    if (!user?.passwordHash) throw new UnauthorizedException('Invalid credentials');

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) throw new UnauthorizedException('Invalid credentials');

    return this.buildAuthResponse(user);
  }

  async updateProfile(
    userId: string,
    firstName: string,
    lastName: string,
    avatar?: { buffer: Buffer; mime: string },
  ) {
    const name = `${firstName} ${lastName}`.trim();
    const normalized = avatar ? await this.normalizeAvatarFromBuffer(avatar) : null;
    const data: Prisma.UserUpdateInput = { firstName, lastName, name };
    if (normalized) {
      Object.assign(data, normalized);
      data.avatarUrl = null;
    }
    const user = await this.usersService.update(userId, data);
    return this.toPublicUser(user);
  }

  async changePassword(userId: string, currentPassword: string, newPassword: string) {
    const user = await this.usersService.findById(userId);
    if (!user?.passwordHash) throw new BadRequestException('Password login is not enabled for this account');

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) throw new BadRequestException('Current password is incorrect');

    const passwordHash = await bcrypt.hash(newPassword, 10);
    await this.usersService.update(userId, { passwordHash });
    return this.toPublicUser({ ...user, passwordHash });
  }

  private async tryPersistRemoteAvatar(userId: string, url: string) {
    try {
      const res = await fetch(url);
      const contentType = res.headers.get('content-type') || '';
      const arrayBuffer = await res.arrayBuffer();
      const buf = Buffer.from(arrayBuffer);
      const normalized = await this.normalizeAvatarFromBuffer({
        buffer: buf,
        mime: contentType.split(';')[0] || 'image/jpeg',
      });
      if (!normalized) return null;
      return await this.usersService.update(userId, {
        avatarUrl: url,
        ...normalized,
      });
    } catch {
      return null;
    }
  }

  async validateGoogleUser(profile: {
    googleId: string;
    email: string;
    name: string;
    firstName?: string;
    lastName?: string;
    avatarUrl?: string;
  }) {
    let user = await this.usersService.findByGoogleId(profile.googleId);
    const firstName = profile.firstName || '';
    const lastName = profile.lastName || '';
    const name = profile.name || `${firstName} ${lastName}`.trim();
    if (!user) user = await this.usersService.findByEmail(profile.email);

    if (user) {
      user = await this.usersService.update(user.id, {
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
        ...(firstName ? { firstName } : {}),
        ...(lastName ? { lastName } : {}),
        ...(name ? { name } : {}),
      });
    } else {
      user = await this.usersService.create({
        email: profile.email,
        name,
        firstName,
        lastName,
        googleId: profile.googleId,
        avatarUrl: profile.avatarUrl,
      });
    }

    if (profile.avatarUrl) {
      const updated = await this.tryPersistRemoteAvatar(user.id, profile.avatarUrl);
      if (updated) user = updated;
    }
    return this.buildAuthResponse(user);
  }

  buildAuthResponse(user: any) {
    const payload = { sub: user.id, email: user.email };
    return {
      accessToken: this.jwtService.sign(payload),
      user: this.toPublicUser(user),
    };
  }

  async validateJwtPayload(payload: { sub: string }) {
    return this.usersService.findById(payload.sub);
  }
}
