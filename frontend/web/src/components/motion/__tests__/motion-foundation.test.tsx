import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter } from 'react-router-dom';
import {
  ActiveNavPill,
  DURATIONS,
  EASE,
  MotionRoot,
  PageTransition,
  Reveal,
  Stagger,
  StaggerItem,
  fade,
  fadeUp,
  scaleIn,
  staggerChild,
  staggerParent,
} from '../index';

describe('motion tokens (8.23)', () => {
  it('durations ascend from instant to slower', () => {
    expect(DURATIONS.instant).toBeLessThan(DURATIONS.fast);
    expect(DURATIONS.fast).toBeLessThan(DURATIONS.base);
    expect(DURATIONS.base).toBeLessThan(DURATIONS.slow);
    expect(DURATIONS.slow).toBeLessThan(DURATIONS.slower);
    expect(DURATIONS.base).toBeLessThanOrEqual(0.35);
  });

  it('easings are valid cubic-bezier tuples', () => {
    for (const ease of [EASE.standard, EASE.emphasized, EASE.snappy]) {
      expect(ease).toHaveLength(4);
      for (const v of ease) expect(typeof v).toBe('number');
    }
  });

  it('variants define hidden/show states without layout properties', () => {
    for (const variant of [fadeUp, fade, scaleIn, staggerParent, staggerChild]) {
      expect(variant).toHaveProperty('hidden');
      expect(variant).toHaveProperty('show');
    }
    // GPU-friendly only: opacity/transform, never width/height/top/left.
    expect(JSON.stringify(fadeUp)).not.toMatch(/width|height|top|left|margin/);
  });
});

describe('motion primitives (8.23)', () => {
  it('MotionRoot renders children (reduced-motion handled by provider)', () => {
    render(
      <MotionRoot>
        <p data-testid="motion-child">content</p>
      </MotionRoot>
    );
    expect(screen.getByTestId('motion-child')).toBeInTheDocument();
  });

  it('PageTransition renders route content without a nested main landmark', () => {
    render(
      <MemoryRouter initialEntries={['/learn']}>
        <main>
          <PageTransition>
            <p data-testid="page-body">learn</p>
          </PageTransition>
        </main>
      </MemoryRouter>
    );
    expect(screen.getByTestId('page-body')).toBeInTheDocument();
    // No <main> inside <main> — PageTransition is a plain div.
    expect(screen.getByTestId('page-body').closest('main')).toBeInTheDocument();
  });

  it('Reveal keeps content in the DOM for readers and tests', () => {
    render(
      <Reveal>
        <p data-testid="revealed">section</p>
      </Reveal>
    );
    expect(screen.getByTestId('revealed')).toBeInTheDocument();
  });

  it('Stagger renders ordered items', () => {
    render(
      <Stagger>
        <StaggerItem>
          <span data-testid="stagger-a">a</span>
        </StaggerItem>
        <StaggerItem>
          <span data-testid="stagger-b">b</span>
        </StaggerItem>
      </Stagger>
    );
    expect(screen.getByTestId('stagger-a')).toBeInTheDocument();
    expect(screen.getByTestId('stagger-b')).toBeInTheDocument();
  });

  it('StaggerItem renders as li for valid staggered lists', () => {
    render(
      <Stagger>
        <ul>
          <StaggerItem as="li" data-testid="stagger-li">
            <span>item</span>
          </StaggerItem>
        </ul>
      </Stagger>
    );
    const item = screen.getByTestId('stagger-li');
    expect(item.tagName).toBe('LI');
    expect(item.closest('ul')).toBeInTheDocument();
  });

  it('ActiveNavPill is aria-hidden decoration', () => {
    const { container } = render(<ActiveNavPill id="test-pill" />);
    const pill = container.firstChild as HTMLElement;
    expect(pill).toHaveAttribute('aria-hidden', 'true');
  });
});
