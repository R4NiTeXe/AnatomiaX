import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import ProgressRing from '../ProgressRing';

describe('ProgressRing', () => {
  it('renders the derived percentage with an accessible label', () => {
    render(<ProgressRing value={3} max={12} />);
    expect(screen.getByTestId('progress-ring')).toHaveAttribute(
      'aria-label',
      '25 percent complete'
    );
    expect(screen.getByTestId('progress-ring-value')).toHaveTextContent('25%');
  });

  it('clamps out-of-range input instead of rendering nonsense', () => {
    const { rerender } = render(<ProgressRing value={99} max={10} testId="ring-clamped" />);
    expect(screen.getByTestId('ring-clamped-value')).toHaveTextContent('100%');
    rerender(<ProgressRing value={-4} max={10} testId="ring-clamped" />);
    expect(screen.getByTestId('ring-clamped-value')).toHaveTextContent('0%');
  });

  it('renders an empty ring when there is no documented total', () => {
    render(<ProgressRing value={5} max={0} />);
    expect(screen.getByTestId('progress-ring-value')).toHaveTextContent('0%');
  });

  it('respects custom size and test id', () => {
    render(<ProgressRing value={1} max={2} size={64} testId="ring-small" />);
    const ring = screen.getByTestId('ring-small');
    expect(ring).toHaveAttribute('aria-label', '50 percent complete');
    expect(ring.querySelector('svg')).toHaveAttribute('width', '64');
  });
});
