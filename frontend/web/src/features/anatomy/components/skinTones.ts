export type SkinToneId = 'light' | 'mediumLight' | 'medium' | 'mediumDeep' | 'deep';

export interface SkinTonePreset {
  id: SkinToneId;
  label: string;
  shortLabel: string;
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
