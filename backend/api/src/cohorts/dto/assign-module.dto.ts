import { IsIn, IsString } from 'class-validator';

// Mirrors the frontend static module registry (one module per anatomy
// system). Duplicated as literals so validation works without importing
// frontend code into the API.
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
