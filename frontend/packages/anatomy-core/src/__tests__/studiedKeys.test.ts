import { parseStudiedKey } from '../studiedKeys';

describe('parseStudiedKey', () => {
  it('parses verified keys with canonical names', () => {
    expect(parseStudiedKey('male:skin:UBERON:0002097')).toMatchObject({
      structureKey: 'male:skin:UBERON:0002097',
      name: 'Skin',
      objectName: 'UBERON:0002097',
      systemKey: 'skin',
      bodyModel: 'male',
      ontologyId: 'UBERON:0002097',
    });
  });

  it('parses object-fallback keys without verified info', () => {
    expect(parseStudiedKey('female:nervous:object:Custom Region')).toMatchObject({
      name: 'Custom Region',
      objectName: 'Custom Region',
      ontologyId: null,
    });
  });

  it('rejects malformed keys', () => {
    expect(parseStudiedKey('')).toBeNull();
    expect(parseStudiedKey('justonepart')).toBeNull();
    expect(parseStudiedKey('alien:skin:UBERON:0002097')).toBeNull();
    expect(parseStudiedKey('male::')).toBeNull();
    expect(parseStudiedKey('x'.repeat(300))).toBeNull();
  });

  it('falls back to the full key for empty object names', () => {
    const parsed = parseStudiedKey('male:skin:object:');
    expect(parsed).not.toBeNull();
    expect(parsed?.objectName).toBe('male:skin:object:');
    expect(parsed?.ontologyId).toBeNull();
  });
});
