import { IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

export class CreateCohortDto {
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name!: string;

  @IsOptional()
  @IsString()
  @MaxLength(120)
  institutionLabel?: string;
}
