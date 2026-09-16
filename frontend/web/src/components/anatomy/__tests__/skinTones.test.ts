import { DEFAULT_SKIN_TONE, SKIN_TONES, getSkinTone, type SkinToneId } from '../skinTones';

describe('skinTones (8.31)', () => {
  it('provides exactly five neutral presets', () => {
    expect(SKIN_TONES).toHaveLength(5);
    expect(SKIN_TONES.map(p => p.id)).toEqual([
      'light',
      'mediumLight',
      'medium',
      'mediumDeep',
      'deep',
    ]);
  });

  it('uses valid distinct sRGB hex colors with labels', () => {
    const colors = new Set<string>();
    for (const preset of SKIN_TONES) {
      expect(preset.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      expect(preset.label.length).toBeGreaterThan(0);
      expect(preset.shortLabel.length).toBeGreaterThan(0);
      colors.add(preset.color.toLowerCase());
    }
    expect(colors.size).toBe(5);
  });

  it('defaults to medium and falls back for unknown ids', () => {
    expect(DEFAULT_SKIN_TONE).toBe('medium');
    expect(getSkinTone('deep').color).toBe(SKIN_TONES.find(p => p.id === 'deep')?.color);
    expect(getSkinTone('unknown' as SkinToneId).id).toBe('medium');
  });
});
