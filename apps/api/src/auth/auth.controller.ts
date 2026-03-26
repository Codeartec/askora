import { Controller, Post, Body, Get, Patch, UseGuards, Req, Res, UseInterceptors, UploadedFile } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { AuthService } from './auth.service';
import { RegisterDto, LoginDto, UpdateProfileDto, ChangePasswordDto } from './dto/auth.dto';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('register')
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
        cb(ok ? null : new Error('Unsupported file type'), ok);
      },
    }),
  )
  register(@Body() dto: RegisterDto, @UploadedFile() avatar?: any) {
    return this.authService.register(dto.email, dto.password, dto.firstName, dto.lastName, avatar ? { buffer: avatar.buffer, mime: avatar.mimetype } : undefined);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.authService.login(dto.email, dto.password);
  }

  @Get('google')
  @UseGuards(AuthGuard('google'))
  googleLogin() {
    return;
  }

  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  async googleCallback(@Req() req: any, @Res() res: Response) {
    const result = await this.authService.validateGoogleUser(req.user);
    const frontendUrl = process.env.NODE_ENV === 'production' ? '' : 'http://localhost:5173';
    res.redirect(`${frontendUrl}/auth/callback?token=${result.accessToken}`);
  }

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  getMe(@Req() req: any) {
    return this.authService.toPublicUser(req.user);
  }

  @Patch('me')
  @UseGuards(AuthGuard('jwt'))
  @UseInterceptors(
    FileInterceptor('avatar', {
      limits: { fileSize: 5 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        const ok = ['image/png', 'image/jpeg', 'image/webp'].includes(file.mimetype);
        cb(ok ? null : new Error('Unsupported file type'), ok);
      },
    }),
  )
  updateMe(@Req() req: any, @Body() dto: UpdateProfileDto, @UploadedFile() avatar?: any) {
    return this.authService.updateProfile(
      req.user.id,
      dto.firstName,
      dto.lastName,
      avatar ? { buffer: avatar.buffer, mime: avatar.mimetype } : undefined,
    );
  }

  @Post('me/password')
  @UseGuards(AuthGuard('jwt'))
  changePassword(@Req() req: any, @Body() dto: ChangePasswordDto) {
    return this.authService.changePassword(req.user.id, dto.currentPassword, dto.newPassword);
  }
}
