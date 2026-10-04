import { IsEmail, IsIn, IsOptional, IsString, MaxLength } from 'class-validator';

export class LoginDto {
  @IsEmail()
  @MaxLength(254)
  email!: string;

  @IsString()
  @MaxLength(128)
  password!: string;

  /**
   * Requested role from the login role-selector. Advisory only: the
   * database role is authoritative. A mismatch rejects with the generic
   * credential error and creates no session (never escalates, never
   * modifies the account). Forged values are rejected by the whitelist.
   */
  @IsOptional()
  @IsIn(['STUDENT', 'TEACHER', 'ADMIN'])
  role?: string;
}
