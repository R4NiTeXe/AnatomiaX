/**
 * Centralized skin-tone configuration (STEP 8.31).
 * Small set of natural, muted presets with neutral descriptive identifiers.
 * Hex colors are sRGB; THREE.ColorManagement converts them to the linear
 * working space when applied to materials.
 */
export type SkinToneId = 'light' | 'mediumLight' | 'medium' | 'mediumDeep' | 'deep';

export interface SkinTonePreset {
  id: SkinToneId;
  /** Full descriptive label (accessible names, titles). */
  label: string;
  /** Compact visible label for the segmented control. */
  shortLabel: string;
  /** sRGB base color applied to skin material color. */
  color: string;
}

export const SKIN_TONES: readonly SkinTonePreset[] = [
  { id: 'light', label: 'Light', color: '#E7B48F', shortLabel: 'Light' },
  { id: 'mediumLight', label: 'Medium light', color: '#D29A6E', shortLabel: 'Med light' },
  { id: 'medium', label: 'Medium', color: '#A9744F', shortLabel: 'Medium' },
  { id: 'mediumDeep', label: 'Medium deep', color: '#7C5233', shortLabel: 'Med deep' },
  { id: 'deep', label: 'Deep', color: '#54371F', shortLabel: 'Deep' },
];

export const DEFAULT_SKIN_TONE: SkinToneId = 'medium';

export function getSkinTone(id: SkinToneId): SkinTonePreset {
  return SKIN_TONES.find(preset => preset.id === id) ?? SKIN_TONES[2];
}
