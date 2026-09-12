import {
  DEFAULT_STAGE_SYSTEM,
  MAX_STAGE_BYTES,
  SUPPORTED_STAGE_SYSTEMS,
  isStageSupported,
} from '../supportedScope';

describe('stage scope (8.19.35)', () => {
  it('starts with skin and stays within male <=5MB systems', () => {
    expect(DEFAULT_STAGE_SYSTEM).toBe('skin');
    expect(SUPPORTED_STAGE_SYSTEMS.map(s => s.system)).toContain('skin');
    for (const entry of SUPPORTED_STAGE_SYSTEMS) {
      expect(entry.bytes).toBeLessThanOrEqual(MAX_STAGE_BYTES);
    }
  });

  it('excludes the nervous system and the female model', () => {
    expect(SUPPORTED_STAGE_SYSTEMS.map(s => s.system)).not.toContain('nervous');
    expect(isStageSupported('male', 'skin')).toBe(true);
    expect(isStageSupported('male', 'nervous')).toBe(false);
    expect(isStageSupported('female', 'skin')).toBe(false);
    expect(isStageSupported('male', 'bogus')).toBe(false);
  });
});
