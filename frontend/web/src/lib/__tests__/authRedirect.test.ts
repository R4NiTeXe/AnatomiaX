import { safeAuthDestination } from '../authRedirect';

describe('safeAuthDestination', () => {
  it('keeps valid in-app destinations', () => {
    expect(safeAuthDestination('/account')).toBe('/account');
    expect(safeAuthDestination('/account?tab=x')).toBe('/account?tab=x');
  });

  it('falls back for auth pages, externals, and garbage', () => {
    expect(safeAuthDestination('/login')).toBe('/human');
    expect(safeAuthDestination('/register')).toBe('/human');
    expect(safeAuthDestination('https://evil.example/x')).toBe('/human');
    expect(safeAuthDestination('//evil.example')).toBe('/human');
    expect(safeAuthDestination(undefined)).toBe('/human');
    expect(safeAuthDestination(null)).toBe('/human');
  });
});
