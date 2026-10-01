import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import RivePlayer from '../RivePlayer';
import LottiePlayer from '../LottiePlayer';

function mockReducedMotion(matches: boolean) {
  const mq = {
    matches,
    media: '(prefers-reduced-motion: reduce)',
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  };
  return jest.spyOn(window, 'matchMedia').mockReturnValue(mq as unknown as MediaQueryList);
}

describe('animation players (reduced-motion posters)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('RivePlayer renders the poster with img role when labeled', () => {
    mockReducedMotion(true);
    render(<RivePlayer src="x.riv" ariaLabel="Play icon" poster={<span>poster-x</span>} />);
    expect(screen.getByRole('img', { name: 'Play icon' })).toHaveTextContent('poster-x');
  });

  it('RivePlayer renders the poster without a role when unlabeled', () => {
    mockReducedMotion(true);
    render(<RivePlayer src="x.riv" poster={<span>poster-y</span>} />);
    expect(screen.getByText('poster-y')).toBeInTheDocument();
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  it('LottiePlayer renders the poster with img role when labeled', () => {
    mockReducedMotion(true);
    render(<LottiePlayer src="x.lottie" ariaLabel="Loading art" poster={<span>poster-z</span>} />);
    expect(screen.getByRole('img', { name: 'Loading art' })).toHaveTextContent('poster-z');
  });

  it('players fall back to the poster while the runtime lazy-loads', () => {
    mockReducedMotion(false);
    render(<LottiePlayer src="x.lottie" poster={<span>poster-lazy</span>} />);
    expect(screen.getByText('poster-lazy')).toBeInTheDocument();
  });
});
