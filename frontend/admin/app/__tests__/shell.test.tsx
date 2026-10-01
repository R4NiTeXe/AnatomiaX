import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { Providers } from '../providers';
import { safeAuthDestination } from '@/lib/authRedirect';

describe('admin shell', () => {
  it('provides an isolated query client to children', () => {
    render(
      <Providers>
        <span data-testid="shell-child">child</span>
      </Providers>
    );
    expect(screen.getByTestId('shell-child')).toHaveTextContent('child');
  });

  it('accepts safe in-app destinations', () => {
    expect(safeAuthDestination('/cohorts')).toBe('/cohorts');
    expect(safeAuthDestination('/cohorts/c-1?tab=members')).toBe('/cohorts/c-1?tab=members');
  });

  it('rejects external, protocol-relative, and auth-loop destinations', () => {
    expect(safeAuthDestination('https://evil.example/x')).toBe('/human');
    expect(safeAuthDestination('//evil.example/x')).toBe('/human');
    expect(safeAuthDestination('/login')).toBe('/human');
    expect(safeAuthDestination('/register')).toBe('/human');
    expect(safeAuthDestination(undefined)).toBe('/human');
    expect(safeAuthDestination(42)).toBe('/human');
    expect(safeAuthDestination('/cohorts', '/admin')).toBe('/cohorts');
  });
});
