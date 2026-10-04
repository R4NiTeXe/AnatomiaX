import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class UpdateQuestionDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  prompt?: string;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  options?: string[];

  @IsOptional()
  @IsInt()
  @Min(0)
  correctIndex?: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
