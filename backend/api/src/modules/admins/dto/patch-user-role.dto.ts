import { IsIn } from 'class-validator';

export class PatchUserRoleDto {
  @IsIn(['STUDENT', 'TEACHER', 'ADMIN'])
  role!: 'STUDENT' | 'TEACHER' | 'ADMIN';
}
