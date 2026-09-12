import type { AnatomyBodyModelKey } from '@anatomiax/shared-types';
import { parseStudiedKey } from '@anatomiax/anatomy-core';

describe('mobile workspace resolution (8.19.26)', () => {
  it('links @anatomiax/shared-types as a real dependency', () => {
    expect(() => require.resolve('@anatomiax/shared-types')).not.toThrow();
  });

  it('consumes shared domain types without duplication', () => {
    const model: AnatomyBodyModelKey = 'female';
    expect(model).toBe('female');
  });

  it('imports and executes @anatomiax/anatomy-core pure logic (8.19.33)', () => {
    expect(() => require.resolve('@anatomiax/anatomy-core')).not.toThrow();
    expect(parseStudiedKey('male:skin:UBERON:0002097')).toMatchObject({
      name: 'Skin',
      bodyModel: 'male',
      systemKey: 'skin',
    });
    expect(parseStudiedKey('bogus')).toBeNull();
  });
});
