import { IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';

export class QuizAnswerDto {
  @IsOptional()
  @IsString()
  @MaxLength(256)
  structureKey?: string;

  @IsOptional()
  @IsString()
  @MaxLength(160)
  canonicalName?: string;

  @IsInt()
  @Min(0)
  selected!: number;

  @IsInt()
  @Min(0)
  correct!: number;
}
