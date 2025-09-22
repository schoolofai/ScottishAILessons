'use client';

import { cn } from '../../lib/utils';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '../ui/tooltip';

export interface ReasonBadgeProps {
  reason: string;
  className?: string;
  showTooltip?: boolean;
  onClick?: () => void;
}

// Color mapping for different reason types based on scoring algorithm
const reasonColorMap: Record<string, { bg: string; text: string; description: string }> = {
  // Positive reasons (bonuses)
  'overdue': {
    bg: 'bg-red-100 dark:bg-red-900/20',
    text: 'text-red-800 dark:text-red-200',
    description: 'This lesson addresses overdue learning outcomes that need immediate attention'
  },
  'low mastery': {
    bg: 'bg-orange-100 dark:bg-orange-900/20',
    text: 'text-orange-800 dark:text-orange-200',
    description: 'Student has low mastery scores in related skills and would benefit from practice'
  },
  'early order': {
    bg: 'bg-green-100 dark:bg-green-900/20',
    text: 'text-green-800 dark:text-green-200',
    description: 'This lesson follows the natural progression order in the curriculum'
  },
  'short win': {
    bg: 'bg-blue-100 dark:bg-blue-900/20',
    text: 'text-blue-800 dark:text-blue-200',
    description: 'A quick lesson that can boost confidence and provide an easy win'
  },

  // Penalty reasons (negative factors)
  'recent': {
    bg: 'bg-gray-100 dark:bg-gray-800/20',
    text: 'text-gray-800 dark:text-gray-200',
    description: 'This lesson was taught recently, so it has lower priority'
  },
  'long lesson': {
    bg: 'bg-yellow-100 dark:bg-yellow-900/20',
    text: 'text-yellow-800 dark:text-yellow-200',
    description: 'This lesson takes more time than available in the current session'
  }
};

// Default styling for unknown reasons
const defaultReasonStyle = {
  bg: 'bg-gray-100 dark:bg-gray-800/20',
  text: 'text-gray-700 dark:text-gray-300',
  description: 'Custom reason from the AI recommendation algorithm'
};

export function ReasonBadge({
  reason,
  className,
  showTooltip = true,
  onClick
}: ReasonBadgeProps) {
  const reasonStyle = reasonColorMap[reason.toLowerCase()] || defaultReasonStyle;

  const badgeClasses = cn(
    'inline-flex items-center px-2 py-1 rounded-full text-xs font-medium transition-colors',
    'hover:opacity-80 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500',
    reasonStyle.bg,
    reasonStyle.text,
    onClick && 'cursor-pointer hover:scale-105 transform transition-transform',
    className
  );

  const badge = (
    <span
      className={badgeClasses}
      data-testid={`reason-badge-${reason}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          onClick();
        }
      } : undefined}
    >
      {reason}
    </span>
  );

  if (!showTooltip) {
    return badge;
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          {badge}
        </TooltipTrigger>
        <TooltipContent
          data-testid="reason-tooltip"
          className="max-w-xs text-sm"
        >
          <p className="font-medium mb-1">{reason}</p>
          <p className="text-xs opacity-90">
            {reasonStyle.description}
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Component to display multiple reason badges in a consistent layout
 */
export interface ReasonBadgeListProps {
  reasons: string[];
  className?: string;
  showTooltips?: boolean;
  onReasonClick?: (reason: string) => void;
  maxDisplay?: number;
}

export function ReasonBadgeList({
  reasons,
  className,
  showTooltips = true,
  onReasonClick,
  maxDisplay = 3
}: ReasonBadgeListProps) {
  const displayReasons = reasons.slice(0, maxDisplay);
  const hiddenCount = reasons.length - maxDisplay;

  return (
    <div
      className={cn('flex flex-wrap gap-1', className)}
      data-testid="reason-badge-list"
    >
      {displayReasons.map((reason, index) => (
        <ReasonBadge
          key={`${reason}-${index}`}
          reason={reason}
          showTooltip={showTooltips}
          onClick={onReasonClick ? () => onReasonClick(reason) : undefined}
        />
      ))}
      {hiddenCount > 0 && (
        <span
          className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
          data-testid="reason-badge-more"
        >
          +{hiddenCount} more
        </span>
      )}
    </div>
  );
}

export default ReasonBadge;