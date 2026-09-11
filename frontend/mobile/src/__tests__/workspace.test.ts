import type { AnatomyBodyModelKey } from '@anatomiax/shared-types';

describe('mobile workspace resolution (8.19.26)', () => {
  it('links @anatomiax/shared-types as a real dependency', () => {
    expect(() => require.resolve('@anatomiax/shared-types')).not.toThrow();
  });

  it('consumes shared domain types without duplication', () => {
    const model: AnatomyBodyModelKey = 'female';
    expect(model).toBe('female');
  });
});
