import { IsIn } from 'class-validator';

/**
 * Role provisioning is ADMIN-only (controller class guard) and validated
 * here: forged role values never reach the service (400 via whitelist pipe).
 * Registration stays STUDENT-only — roles are assigned here, never by users.
 */
export class PatchUserRoleDto {
  @IsIn(['STUDENT', 'TEACHER', 'ADMIN'])
  role!: 'STUDENT' | 'TEACHER' | 'ADMIN';
}
