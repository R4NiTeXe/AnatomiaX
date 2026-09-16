import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { LottieVisual } from '../index';
import { animationSrc } from '../registry';

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

describe('LottieVisual (8.29)', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  it('renders the registry-derived asset source', async () => {
    mockReducedMotion(false);
    render(<LottieVisual asset="body-scan" label="Body scan" testId="story" />);
    expect(await screen.findByTestId('dotlottie-mock')).toHaveAttribute(
      'data-src',
      animationSrc('body-scan')
    );
  });

  it('renders a meaningful static poster under reduced motion without the runtime', () => {
    mockReducedMotion(true);
    render(<LottieVisual asset="medical-technology" label="Tech" testId="story" />);
    expect(screen.queryByTestId('dotlottie-mock')).not.toBeInTheDocument();
    expect(screen.getByTestId('story')).toHaveTextContent('Technology preview');
  });

  it('hides decorative visuals from assistive technology', async () => {
    mockReducedMotion(false);
    render(<LottieVisual asset="body-scan" decorative testId="story" />);
    expect(screen.getByTestId('story')).toHaveAttribute('aria-hidden', 'true');
    // Runtime still lazy-loads for non-reduced users.
    await screen.findByTestId('dotlottie-mock');
  });
});
