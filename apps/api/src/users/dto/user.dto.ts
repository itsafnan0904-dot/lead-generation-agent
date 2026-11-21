import { IsBoolean, IsEmail, IsEnum, IsNotEmpty, IsOptional, IsString, Matches, MaxLength, MinLength } from 'class-validator';
import { UserRole } from '@ai-sales-agent/database';

const PASSWORD_RULE = /(?:(?=.*\d)|(?=.*\W+))(?![.\n])(?=.*[A-Z])(?=.*[a-z]).*$/;
const PASSWORD_MESSAGE = 'Password must contain at least one uppercase letter, one lowercase letter, and one number or special character';

export class CreateUserDto {
  @IsEmail({}, { message: 'A valid email address is required' }) @MaxLength(254)
  email!: string;

  @IsString() @IsNotEmpty() @MaxLength(100)
  name!: string;

  @IsString() @MinLength(10) @MaxLength(72) @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;

  @IsEnum(UserRole)
  role!: UserRole;
}

export class UpdateUserDto {
  @IsOptional() @IsString() @IsNotEmpty() @MaxLength(100)
  name?: string;

  @IsOptional() @IsEnum(UserRole)
  role?: UserRole;

  @IsOptional() @IsBoolean()
  isActive?: boolean;
}

export class ResetPasswordDto {
  @IsString() @MinLength(10) @MaxLength(72) @Matches(PASSWORD_RULE, { message: PASSWORD_MESSAGE })
  password!: string;
}
