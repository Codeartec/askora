import { IsEmail, IsString, Matches, MinLength } from 'class-validator';

const STRONG_PASSWORD_REGEX = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^A-Za-z\d]).+$/;
const STRONG_SECRET_MESSAGE =
  'Value must include at least one uppercase letter, one lowercase letter, one number, and one symbol';

export class RegisterDto {
  @IsEmail()
  email: string;

  @IsString()
  @MinLength(8)
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_SECRET_MESSAGE })
  password: string;

  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;
}

export class LoginDto {
  @IsEmail()
  email: string;

  @IsString()
  password: string;
}

export class UpdateProfileDto {
  @IsString()
  @MinLength(2)
  firstName: string;

  @IsString()
  @MinLength(2)
  lastName: string;
}

export class ChangePasswordDto {
  @IsString()
  currentPassword: string;

  @IsString()
  @MinLength(8)
  @Matches(STRONG_PASSWORD_REGEX, { message: STRONG_SECRET_MESSAGE })
  newPassword: string;
}
