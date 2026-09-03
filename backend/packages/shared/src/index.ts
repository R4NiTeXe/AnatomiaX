// Backend shared — re-exports canonical types from @anatomiax/shared-types
// No duplicates. Frontend/web remains canonical source until a root shared workspace is introduced.

export type {
  AnatomySystemKey,
  AnatomySystemType,
  AnatomyBodyModelKey,
  AnatomyStructure,
  AnatomySelection,
  SelectedStructure,
  AnatomySearchResult,
  AnatomySearchOptions,
  AnatomyInformationSourceCategory,
  AnatomyInformationProvenance,
  AnatomyInformation,
  AnatomyQuizQuestion,
} from '@anatomiax/shared-types';

export * from '@anatomiax/shared-types';
