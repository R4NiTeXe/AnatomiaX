import { IsEmail, IsString, MaxLength, MinLength } from 'class-validator';

export class ConfirmPasswordResetDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MinLength(20)
  @MaxLength(512)
  token!: string;

  @IsString()
  @MinLength(8)
  @MaxLength(128)
  newPassword!: string;
}
