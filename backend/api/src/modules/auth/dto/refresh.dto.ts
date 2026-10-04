import { IsOptional, IsString, MaxLength } from 'class-validator';

// Refresh token arrives via httpOnly cookie (web) or JSON body (mobile).
export class RefreshDto {
  @IsOptional()
  @IsString()
  @MaxLength(512)
  refreshToken?: string;
}
