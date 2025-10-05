'use client';

import { memo } from 'react';

interface ProgressRingProps {
  percentage: number;
  size?: number;
  strokeWidth?: number;
}

export const ProgressRing = memo(function ProgressRing({ percentage, size = 80, strokeWidth = 8 }: ProgressRingProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percentage / 100) * circumference;

  // Color based on percentage
  const getColor = () => {
    if (percentage < 30) return '#EF4444'; // red
    if (percentage < 50) return '#F97316'; // orange
    if (percentage < 70) return '#EAB308'; // yellow
    if (percentage < 90) return '#84CC16'; // light green
    return '#22C55E'; // dark green
  };

  return (
    <div
      className="relative inline-flex items-center justify-center"
      role="progressbar"
      aria-valuenow={Math.round(percentage)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`Course progress: ${Math.round(percentage)} percent complete`}
    >
      <svg
        width={size}
        height={size}
        className="transform -rotate-90"
        aria-hidden="true"
      >
        {/* Background circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="#E5E7EB"
          strokeWidth={strokeWidth}
          fill="none"
        />

        {/* Progress circle */}
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke={getColor()}
          strokeWidth={strokeWidth}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500 ease-out"
        />
      </svg>

      {/* Percentage text */}
      <div className="absolute inset-0 flex items-center justify-center" aria-hidden="true">
        <span className="text-sm font-bold" style={{ color: getColor() }}>
          {Math.round(percentage)}%
        </span>
      </div>
    </div>
  );
});
