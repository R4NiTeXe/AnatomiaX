import type {
  AnatomyBodyModelKey,
  AnatomySystemKey,
  SelectedStructure,
} from '@anatomiax/shared-types';
import { getAnatomyInformationByStructureKey } from './anatomyInformation';

/**
 * Maps a persisted body-qualified structureKey back to a selection.
 * Returns null for keys that cannot be understood; never throws.
 */
export function parseStudiedKey(key: string): SelectedStructure | null {
  if (typeof key !== 'string' || key.length === 0 || key.length > 256) return null;
  const parts = key.split(':');
  if (parts.length < 3) return null;
  const [bodyModel, systemKey, ...rest] = parts;
  if (bodyModel !== 'male' && bodyModel !== 'female') return null;
  if (!systemKey) return null;
  const remainder = rest.join(':');
  let ontologyId: string | null = null;
  let objectName = remainder;
  if (!remainder.startsWith('object:')) {
    ontologyId = remainder || null;
    objectName = remainder;
  } else {
    objectName = remainder.slice('object:'.length) || key;
  }
  const info = getAnatomyInformationByStructureKey(key);
  const name = info?.canonicalName ?? objectName;
  return {
    structureKey: key,
    name,
    objectName,
    systemKey: systemKey as AnatomySystemKey,
    bodyModel: bodyModel as AnatomyBodyModelKey,
    ontologyId,
  };
}
