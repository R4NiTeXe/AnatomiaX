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

export class AddQuestionDto {
  @IsString()
  @MinLength(1)
  @MaxLength(2000)
  prompt!: string;

  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(8)
  @IsString({ each: true })
  @MaxLength(300, { each: true })
  options!: string[];

  @IsInt()
  @Min(0)
  correctIndex!: number;

  @IsOptional()
  @IsInt()
  @Min(0)
  position?: number;
}
