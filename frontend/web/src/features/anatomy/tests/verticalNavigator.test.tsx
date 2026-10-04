import { render, screen, fireEvent } from '@testing-library/react';
import '@testing-library/jest-dom';
import AnatomyVerticalNavigator from '../components/AnatomyVerticalNavigator';

describe('AnatomyVerticalNavigator slider UI', () => {
  beforeEach(() => {
    // jsdom lacks pointer capture; the component guards release but not press.
    Object.defineProperty(Element.prototype, 'setPointerCapture', {
      configurable: true,
      value: jest.fn(),
    });
  });

  afterEach(() => {
    jest.restoreAllMocks();
    const proto = Element.prototype as unknown as Record<string, unknown>;
    delete proto.setPointerCapture;
  });

  it('exposes slider semantics with the clamped value', () => {
    render(<AnatomyVerticalNavigator value={0.25} onChange={() => undefined} />);
    const slider = screen.getByRole('slider', { name: 'Move through anatomy vertically' });
    expect(slider).toHaveAttribute('aria-valuenow', '25');
    expect(slider).toHaveAttribute('aria-valuemin', '0');
    expect(slider).toHaveAttribute('aria-valuemax', '100');
  });

  it('clamps out-of-range values', () => {
    const { rerender } = render(<AnatomyVerticalNavigator value={2} onChange={() => undefined} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '100');
    rerender(<AnatomyVerticalNavigator value={-1} onChange={() => undefined} />);
    expect(screen.getByRole('slider')).toHaveAttribute('aria-valuenow', '0');
  });

  it('steps with ArrowUp/ArrowDown and clamps at the ends', () => {
    const onChange = jest.fn();
    const { rerender } = render(<AnatomyVerticalNavigator value={0.5} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(0.45);
    fireEvent.keyDown(slider, { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(0.55);

    rerender(<AnatomyVerticalNavigator value={0} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowUp' });
    expect(onChange).toHaveBeenCalledWith(0);
    rerender(<AnatomyVerticalNavigator value={1} onChange={onChange} />);
    fireEvent.keyDown(screen.getByRole('slider'), { key: 'ArrowDown' });
    expect(onChange).toHaveBeenCalledWith(1);
  });

  it('jumps with PageUp/PageDown/Home/End and ignores other keys', () => {
    const onChange = jest.fn();
    render(<AnatomyVerticalNavigator value={0.5} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.keyDown(slider, { key: 'PageUp' });
    expect(onChange).toHaveBeenCalledWith(0.3);
    fireEvent.keyDown(slider, { key: 'PageDown' });
    expect(onChange).toHaveBeenCalledWith(0.7);
    fireEvent.keyDown(slider, { key: 'Home' });
    expect(onChange).toHaveBeenCalledWith(0);
    fireEvent.keyDown(slider, { key: 'End' });
    expect(onChange).toHaveBeenCalledWith(1);
    onChange.mockClear();
    fireEvent.keyDown(slider, { key: 'a' });
    expect(onChange).not.toHaveBeenCalled();
  });

  it('ends dragging on pointer up without throwing', () => {
    const onChange = jest.fn();
    render(<AnatomyVerticalNavigator value={0.5} onChange={onChange} />);
    const slider = screen.getByRole('slider');
    fireEvent.pointerDown(slider, { clientY: 100, pointerId: 1 });
    fireEvent.pointerUp(slider, { pointerId: 1 });
    fireEvent.pointerCancel(slider, { pointerId: 1 });
    expect(slider).toBeInTheDocument();
  });
});
