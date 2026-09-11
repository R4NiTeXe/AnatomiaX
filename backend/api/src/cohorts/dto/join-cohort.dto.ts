import { IsString, MaxLength, MinLength } from 'class-validator';

export class JoinCohortDto {
  @IsString()
  @MinLength(1)
  @MaxLength(128)
  inviteCode!: string;
}
