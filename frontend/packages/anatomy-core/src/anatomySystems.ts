import type {
  AnatomyBodyModelKey,
  AnatomySystemKey,
  AnatomySystemType,
} from '@anatomiax/shared-types';
import { buildAssetUrl, findManifestEntry } from './assetManifest';

export interface AnatomySystemAsset {
  key: AnatomySystemKey;
  label: string;
  type: AnatomySystemType;
  path: string;
  available: boolean;
}

export interface AnatomySystemDefinition {
  key: AnatomySystemKey;
  label: string;
  asset: AnatomySystemAsset;
  available: boolean;
  displayOrder: number;
}

export interface AnatomyBodyModelDefinition {
  key: AnatomyBodyModelKey;
  label: string;
  systems: Record<AnatomySystemKey, AnatomySystemAsset>;
  available: boolean;
}

declare const process: { env: Record<string, string | undefined> };

export const ASSET_BASE_URL: string = (() => {
  try {
    const configured = process.env.VITE_ANATOMY_ASSET_BASE_URL;
    return configured && configured.trim() !== '' ? configured : '/models-dev/';
  } catch {
    return '/models-dev/';
  }
})();

function assetPath(bodyModel: AnatomyBodyModelKey, file: string): string {
  return buildAssetUrl(ASSET_BASE_URL, bodyModel, file);
}

function defineSystem(
  key: AnatomySystemKey,
  label: string,
  file: string,
  displayOrder: number
): AnatomySystemDefinition {
  const asset: AnatomySystemAsset = {
    key,
    label,
    type: key === 'skin' ? 'body' : 'system',
    path: assetPath('male', file),
    available: true,
  };
  return { key, label, asset, available: true, displayOrder };
}

function manifestFile(bodyModel: AnatomyBodyModelKey, system: AnatomySystemKey): string {
  const entry = findManifestEntry(bodyModel, system);
  if (!entry) throw new Error(`Missing asset manifest entry: ${bodyModel}/${system}`);
  return entry.file;
}

export const ANATOMY_SYSTEM_DEFINITIONS: readonly AnatomySystemDefinition[] = [
  defineSystem('skin', 'Skin', manifestFile('male', 'skin'), 0),
  defineSystem('musculoskeletal', 'Musculoskeletal', manifestFile('male', 'musculoskeletal'), 1),
  defineSystem('nervous', 'Nervous', manifestFile('male', 'nervous'), 2),
  defineSystem('cardiovascular', 'Cardiovascular', manifestFile('male', 'cardiovascular'), 3),
  defineSystem('respiratory', 'Respiratory', manifestFile('male', 'respiratory'), 4),
  defineSystem('digestive', 'Digestive', manifestFile('male', 'digestive'), 5),
  defineSystem('urinary', 'Urinary', manifestFile('male', 'urinary'), 6),
  defineSystem('reproductive', 'Reproductive', manifestFile('male', 'reproductive'), 7),
  defineSystem('lymphatic', 'Lymphatic', manifestFile('male', 'lymphatic'), 8),
];

export const ANATOMY_SYSTEMS_BY_KEY: Readonly<Record<AnatomySystemKey, AnatomySystemDefinition>> =
  Object.fromEntries(ANATOMY_SYSTEM_DEFINITIONS.map(d => [d.key, d])) as Record<
    AnatomySystemKey,
    AnatomySystemDefinition
  >;

export function getAnatomySystemDefinition(key: AnatomySystemKey): AnatomySystemDefinition {
  return ANATOMY_SYSTEMS_BY_KEY[key];
}

export function getAnatomySystemAsset(key: AnatomySystemKey): AnatomySystemAsset {
  return ANATOMY_SYSTEMS_BY_KEY[key].asset;
}

function defineBodySystem(
  bodyModel: AnatomyBodyModelKey,
  key: AnatomySystemKey,
  label: string,
  file: string,
  displayOrder: number,
  available: boolean
): AnatomySystemDefinition {
  const asset: AnatomySystemAsset = {
    key,
    label,
    type: key === 'skin' ? 'body' : 'system',
    path: assetPath(bodyModel, file),
    available,
  };
  return { key, label, asset, available, displayOrder };
}

const MALE_SYSTEMS = ANATOMY_SYSTEM_DEFINITIONS;

const devFemale = (system: AnatomySystemKey): string => manifestFile('female', system);

const FEMALE_SYSTEMS: readonly AnatomySystemDefinition[] = [
  defineBodySystem('female', 'skin', 'Skin', devFemale('skin'), 0, true),
  defineBodySystem(
    'female',
    'musculoskeletal',
    'Musculoskeletal',
    devFemale('musculoskeletal'),
    1,
    true
  ),
  defineBodySystem('female', 'nervous', 'Nervous', devFemale('nervous'), 2, true),
  defineBodySystem(
    'female',
    'cardiovascular',
    'Cardiovascular',
    devFemale('cardiovascular'),
    3,
    true
  ),
  defineBodySystem('female', 'respiratory', 'Respiratory', devFemale('respiratory'), 4, true),
  defineBodySystem('female', 'digestive', 'Digestive', devFemale('digestive'), 5, true),
  defineBodySystem('female', 'urinary', 'Urinary', devFemale('urinary'), 6, true),
  defineBodySystem('female', 'reproductive', 'Reproductive', devFemale('reproductive'), 7, true),
  defineBodySystem('female', 'lymphatic', 'Lymphatic', devFemale('lymphatic'), 8, true),
];

export const ANATOMY_BODY_MODELS: Readonly<
  Record<AnatomyBodyModelKey, AnatomyBodyModelDefinition>
> = {
  male: {
    key: 'male',
    label: 'Male',
    systems: Object.fromEntries(MALE_SYSTEMS.map(d => [d.key, d.asset])) as Record<
      AnatomySystemKey,
      AnatomySystemAsset
    >,
    available: true,
  },
  female: {
    key: 'female',
    label: 'Female',
    systems: Object.fromEntries(FEMALE_SYSTEMS.map(d => [d.key, d.asset])) as Record<
      AnatomySystemKey,
      AnatomySystemAsset
    >,
    available: true,
  },
};

const BODY_SYSTEMS_BY_KEY: Readonly<
  Record<AnatomyBodyModelKey, Readonly<Record<AnatomySystemKey, AnatomySystemDefinition>>>
> = {
  male: ANATOMY_SYSTEMS_BY_KEY,
  female: Object.fromEntries(FEMALE_SYSTEMS.map(d => [d.key, d])) as Record<
    AnatomySystemKey,
    AnatomySystemDefinition
  >,
};

export function getAnatomySystemDefinitionForBody(
  bodyModel: AnatomyBodyModelKey,
  key: AnatomySystemKey
): AnatomySystemDefinition {
  return BODY_SYSTEMS_BY_KEY[bodyModel][key];
}

export function getAnatomySystemAssetForBody(
  bodyModel: AnatomyBodyModelKey,
  key: AnatomySystemKey
): AnatomySystemAsset {
  return BODY_SYSTEMS_BY_KEY[bodyModel][key].asset;
}

export function getBodyModelDefinition(key: AnatomyBodyModelKey): AnatomyBodyModelDefinition {
  return ANATOMY_BODY_MODELS[key];
}
