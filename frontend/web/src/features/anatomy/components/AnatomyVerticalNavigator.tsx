import { useCallback, useRef, useState } from 'react';

type AnatomyVerticalNavigatorProps = {
  value: number;
  onChange: (value: number) => void;
  onReset?: () => void;
};

export default function AnatomyVerticalNavigator({
  value,
  onChange,
}: AnatomyVerticalNavigatorProps): JSX.Element {
  const trackRef = useRef<HTMLDivElement>(null);
  const draggingRef = useRef(false);
  const [isDragging, setIsDragging] = useState(false);

  const clamped = Math.max(0, Math.min(1, value));
  const thumbPosition = `${clamped * 100}%`;

  const updateFromClientY = useCallback(
    (clientY: number) => {
      const track = trackRef.current;
      if (!track) return;
      const rect = track.getBoundingClientRect();
      const y = clientY - rect.top;
      const next = Math.max(0, Math.min(1, y / rect.height));
      onChange(next);
    },
    [onChange]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      e.stopPropagation();
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
      draggingRef.current = true;
      setIsDragging(true);
      updateFromClientY(e.clientY);
    },
    [updateFromClientY]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!draggingRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      updateFromClientY(e.clientY);
    },
    [updateFromClientY]
  );

  const handlePointerUp = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // best-effort: pointer capture release is non-critical
    }
    draggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handlePointerCancel = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      (e.currentTarget as Element).releasePointerCapture(e.pointerId);
    } catch {
      // best-effort: pointer capture release is non-critical
    }
    draggingRef.current = false;
    setIsDragging(false);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      let next = clamped;
      const step = 0.05;
      const largeStep = 0.2;
      switch (e.key) {
        case 'ArrowUp':
          next = Math.max(0, clamped - step);
          e.preventDefault();
          break;
        case 'ArrowDown':
          next = Math.min(1, clamped + step);
          e.preventDefault();
          break;
        case 'PageUp':
          next = Math.max(0, clamped - largeStep);
          e.preventDefault();
          break;
        case 'PageDown':
          next = Math.min(1, clamped + largeStep);
          e.preventDefault();
          break;
        case 'Home':
          next = 0;
          e.preventDefault();
          break;
        case 'End':
          next = 1;
          e.preventDefault();
          break;
        default:
          return;
      }
      onChange(next);
    },
    [clamped, onChange]
  );

  return (
    <div
      ref={trackRef}
      role="slider"
      tabIndex={0}
      aria-label="Move through anatomy vertically"
      aria-valuenow={Math.round(clamped * 100)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-orientation="vertical"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerCancel}
      onKeyDown={handleKeyDown}
      className="absolute right-2 top-1/2 z-10 flex h-56 w-3 -translate-y-1/2 cursor-pointer flex-col items-center justify-center rounded-full border border-slate-700/60 bg-slate-800/70 p-1 backdrop-blur-sm transition-colors before:absolute before:-inset-4 before:content-[''] hover:bg-slate-800/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-400 focus-visible:ring-offset-2 focus-visible:ring-offset-slate-900 sm:right-3 sm:w-3"
      style={{ touchAction: 'none' }}
      title="Move through anatomy vertically"
    >
      <div className="pointer-events-none absolute inset-1 rounded-full bg-slate-700/40" />
      <div
        className={`pointer-events-none absolute left-1/2 h-10 w-2 -translate-x-1/2 rounded-full transition-colors ${isDragging ? 'bg-teal-300' : 'bg-slate-400 hover:bg-slate-300'} `}
        style={{ top: `calc(${thumbPosition} - 20px)` }}
        aria-hidden
      />
      <span className="sr-only">{Math.round(clamped * 100)} percent</span>
    </div>
  );
}
