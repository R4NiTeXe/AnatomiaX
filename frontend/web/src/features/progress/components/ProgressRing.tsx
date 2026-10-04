interface ProgressRingProps {
  /** Numerator, e.g. studied structures. */
  value: number;
  /** Denominator, e.g. documented structures. Zero renders an empty ring. */
  max: number;
  size?: number;
  strokeWidth?: number;
  testId?: string;
}

/**
 * Deterministic SVG progress ring (transform-free, no animation library).
 * Percentage is always derived from real `value`/`max` props — never invented.
 */
export default function ProgressRing({
  value,
  max,
  size = 96,
  strokeWidth = 10,
  testId = 'progress-ring',
}: ProgressRingProps): JSX.Element {
  const safeMax = Number.isFinite(max) && max > 0 ? max : 0;
  const safeValue = Number.isFinite(value) ? Math.max(0, Math.min(value, safeMax)) : 0;
  const percent = safeMax > 0 ? Math.round((safeValue / safeMax) * 100) : 0;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const filled = (percent / 100) * circumference;

  return (
    <div
      role="img"
      aria-label={`${percent} percent complete`}
      data-testid={testId}
      className="relative inline-flex items-center justify-center"
      style={{ width: size, height: size }}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          className="stroke-slate-800"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circumference}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
          className="stroke-teal-400 drop-shadow-[0_0_6px_rgba(45,212,191,0.5)]"
        />
      </svg>
      <span
        data-testid={`${testId}-value`}
        className="absolute text-lg font-bold tabular-nums text-slate-100"
      >
        {percent}%
      </span>
    </div>
  );
}
