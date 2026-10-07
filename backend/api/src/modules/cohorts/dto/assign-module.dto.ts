import { IsIn, IsString } from 'class-validator';

export const ASSIGNABLE_MODULE_KEYS = [
  'skin',
  'musculoskeletal',
  'nervous',
  'cardiovascular',
  'respiratory',
  'digestive',
  'urinary',
  'reproductive',
  'lymphatic',
] as const;

export class AssignModuleDto {
  @IsString()
  @IsIn([...ASSIGNABLE_MODULE_KEYS])
  moduleKey!: string;
}
