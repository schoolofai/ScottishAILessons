'use client';

/**
 * MiniProgressRing - A gamified circular progress indicator
 *
 * Displays a circular SVG progress ring with percentage text.
 * Used in course cards to show completion progress at a glance.
 *
 * @param percentage - Progress percentage (0-100)
 * @param color - CSS color value for the progress stroke
 * @param size - Diameter in pixels (default: 64)
 * @param strokeWidth - Width of the progress stroke (default: 6)
 */

interface MiniProgressRingProps {
  percentage: number;
  color: string;
  size?: number;
  strokeWidth?: number;
  showLabel?: boolean;
}

export function MiniProgressRing({
  percentage,
  color,
  size = 64,
  strokeWidth = 6,
  showLabel = true
}: MiniProgressRingProps) {
  // Calculate SVG parameters
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Clamp percentage to 0-100 range
  const displayPercentage = Math.max(0, Math.min(100, Math.round(percentage)));

  return (
    <div
      className="relative inline-flex items-center justify-center"
      data-testid="mini-progress-ring"
      role="progressbar"
      aria-valuenow={displayPercentage}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`${displayPercentage}% complete`}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="var(--wizard-border, #E5E5E5)"
          strokeWidth={strokeWidth}
          fill="none"
          className="transition-all duration-300"
        />
        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={color}
          strokeWidth={strokeWidth}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          className="transition-all duration-500 ease-out"
          style={{
            filter: displayPercentage === 100 ? `drop-shadow(0 0 4px ${color})` : 'none'
          }}
        />
      </svg>

      {/* Percentage text - positioned in center */}
      {showLabel && (
        <span
          className="absolute inset-0 flex items-center justify-center font-bold text-sm"
          style={{
            color: displayPercentage === 100 ? color : 'var(--wizard-text, #3C3C3C)'
          }}
        >
          {displayPercentage}%
        </span>
      )}
    </div>
  );
}

export default MiniProgressRing;
