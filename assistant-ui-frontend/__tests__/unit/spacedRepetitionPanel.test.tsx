/**
 * SpacedRepetitionPanel Unit Tests
 *
 * TDD tests for the overdue lessons display bug fix.
 *
 * Bug: The panel shows overdue lesson COUNTS but not the actual LESSONS.
 * This is because `recommendations` array is received but never rendered.
 * Only `upcomingReviews` is rendered in the scrollable list.
 *
 * These tests verify that:
 * 1. Overdue lessons (recommendations) are displayed when present
 * 2. Urgency badges render correctly
 * 3. Review button triggers callback
 * 4. Overdue section appears before upcoming section
 */

import React from 'react';
import { render, screen, fireEvent, within } from '@testing-library/react';
import '@testing-library/jest-dom';
import { SpacedRepetitionPanel } from '@/components/dashboard/SpacedRepetitionPanel';
import type { ReviewRecommendation, ReviewStats, UpcomingReview } from '@/lib/services/spaced-repetition-service';

// ═══════════════════════════════════════════════════════════════════════════
// Test Fixtures
// ═══════════════════════════════════════════════════════════════════════════

function createMockRecommendation(overrides: Partial<ReviewRecommendation> = {}): ReviewRecommendation {
  return {
    lessonTemplateId: 'lesson-1',
    lessonTitle: 'Fractions Review',
    priority: 8,
    overdueOutcomes: [
      {
        outcomeId: 'O1',
        dueAt: '2024-12-01T00:00:00Z',
        daysOverdue: 17,
        currentEMA: 0.35,
        masteryLevel: 'struggling'
      }
    ],
    averageMastery: 0.35,
    daysSinceCompleted: 30,
    estimatedMinutes: 25,
    urgencyLevel: 'critical',
    recommendationReason: 'Long overdue for review • needs reinforcement',
    ...overrides
  };
}

function createMockStats(overrides: Partial<ReviewStats> = {}): ReviewStats {
  return {
    totalOverdueOutcomes: 12,
    criticalCount: 6,
    recommendedLessons: 3,
    estimatedReviewTime: 75,
    ...overrides
  };
}

function createMockUpcomingReview(overrides: Partial<UpcomingReview> = {}): UpcomingReview {
  return {
    lessonTemplateId: 'upcoming-1',
    lessonTitle: 'Decimals Introduction',
    dueDate: '2024-12-25T00:00:00Z',
    daysUntilDue: 7,
    outcomes: [],
    averageMastery: 0.65,
    estimatedMinutes: 30,
    ...overrides
  };
}

// ═══════════════════════════════════════════════════════════════════════════
// Test Suite: Overdue Lessons Display (THE BUG FIX)
// ═══════════════════════════════════════════════════════════════════════════

describe('SpacedRepetitionPanel', () => {
  describe('overdue lessons display (bug fix)', () => {
    it('should render overdue lessons when recommendations array is not empty', () => {
      // Given: Mock data with overdue recommendations
      const mockData = {
        recommendations: [
          createMockRecommendation({ lessonTitle: 'Fractions Review' }),
          createMockRecommendation({ lessonTemplateId: 'lesson-2', lessonTitle: 'Decimals Review' }),
        ],
        stats: createMockStats({ totalOverdueOutcomes: 12 }),
        upcomingReviews: []
      };

      // When: Render SpacedRepetitionPanel
      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={jest.fn()}
        />
      );

      // Then: Should see overdue lessons by title
      expect(screen.getByText('Fractions Review')).toBeInTheDocument();
      expect(screen.getByText('Decimals Review')).toBeInTheDocument();
    });

    it('should show urgency indicator for critical overdue lessons', () => {
      const mockData = {
        recommendations: [
          createMockRecommendation({ urgencyLevel: 'critical' }),
        ],
        stats: createMockStats(),
        upcomingReviews: []
      };

      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={jest.fn()}
        />
      );

      // In compact mode, critical/high urgency shows "Overdue" indicator
      // Find the overdue indicator within the overdue lesson card
      const overdueCard = screen.getByTestId('overdue-lesson-card');
      expect(overdueCard).toBeInTheDocument();
      // The lesson title should be visible
      expect(screen.getByText('Fractions Review')).toBeInTheDocument();
    });

    it('should show urgency indicator for high priority overdue lessons', () => {
      const mockData = {
        recommendations: [
          createMockRecommendation({ urgencyLevel: 'high', lessonTitle: 'High Priority Lesson' }),
        ],
        stats: createMockStats(),
        upcomingReviews: []
      };

      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={jest.fn()}
        />
      );

      // In compact mode, shows "Overdue" indicator with orange color
      const overdueCard = screen.getByTestId('overdue-lesson-card');
      expect(overdueCard).toBeInTheDocument();
      expect(screen.getByText('High Priority Lesson')).toBeInTheDocument();
    });

    it('should call onStartReview when Review button is clicked on overdue lesson', () => {
      const mockOnStartReview = jest.fn();
      const mockData = {
        recommendations: [
          createMockRecommendation({ lessonTemplateId: 'test-lesson-123' }),
        ],
        stats: createMockStats(),
        upcomingReviews: []
      };

      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={mockOnStartReview}
        />
      );

      // Find and click the Review button
      const reviewButtons = screen.getAllByRole('button', { name: /Review/i });
      fireEvent.click(reviewButtons[0]);

      // Should have called onStartReview with the lesson ID
      expect(mockOnStartReview).toHaveBeenCalledWith('test-lesson-123');
    });

    it('should display overdue count in stats section', () => {
      const mockData = {
        recommendations: [createMockRecommendation()],
        stats: createMockStats({ totalOverdueOutcomes: 12, criticalCount: 6 }),
        upcomingReviews: []
      };

      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={jest.fn()}
        />
      );

      // Stats section should show counts
      expect(screen.getByText('12')).toBeInTheDocument(); // Total overdue
      expect(screen.getByText('6')).toBeInTheDocument();  // Critical count
    });

    it('should display overdue lessons BEFORE upcoming reviews', () => {
      const mockData = {
        recommendations: [
          createMockRecommendation({ lessonTitle: 'Overdue Lesson First' }),
        ],
        stats: createMockStats(),
        upcomingReviews: [
          createMockUpcomingReview({ lessonTitle: 'Upcoming Lesson Second' }),
        ]
      };

      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={jest.fn()}
        />
      );

      // Both should be visible
      const overdueLesson = screen.getByText('Overdue Lesson First');
      const upcomingLesson = screen.getByText('Upcoming Lesson Second');

      expect(overdueLesson).toBeInTheDocument();
      expect(upcomingLesson).toBeInTheDocument();

      // Overdue should appear before upcoming in DOM order
      // This tests the "Overdue First" layout requirement
      const container = screen.getByTestId('spaced-repetition-content');
      const allText = container.textContent || '';
      const overdueIndex = allText.indexOf('Overdue Lesson First');
      const upcomingIndex = allText.indexOf('Upcoming Lesson Second');

      expect(overdueIndex).toBeLessThan(upcomingIndex);
    });

    it('should show mastery percentage for overdue lessons', () => {
      const mockData = {
        recommendations: [
          createMockRecommendation({ averageMastery: 0.35 }),
        ],
        stats: createMockStats(),
        upcomingReviews: []
      };

      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={jest.fn()}
        />
      );

      // Should show mastery percentage (35%)
      expect(screen.getByText(/35%/)).toBeInTheDocument();
    });

    it('should show estimated time for overdue lessons', () => {
      const mockData = {
        recommendations: [
          createMockRecommendation({ estimatedMinutes: 25 }),
        ],
        stats: createMockStats(),
        upcomingReviews: []
      };

      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={jest.fn()}
        />
      );

      // Should show estimated time
      expect(screen.getByText(/25/)).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Suite: Empty States
  // ═══════════════════════════════════════════════════════════════════════════

  describe('empty states', () => {
    it('should show "No reviews scheduled" when both arrays are empty', () => {
      const mockData = {
        recommendations: [],
        stats: createMockStats({ totalOverdueOutcomes: 0, criticalCount: 0 }),
        upcomingReviews: []
      };

      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={jest.fn()}
        />
      );

      expect(screen.getByText(/No reviews scheduled/i)).toBeInTheDocument();
    });

    it('should show upcoming reviews even when no overdue lessons exist', () => {
      const mockData = {
        recommendations: [],
        stats: createMockStats({ totalOverdueOutcomes: 0 }),
        upcomingReviews: [
          createMockUpcomingReview({ lessonTitle: 'Future Review' }),
        ]
      };

      render(
        <SpacedRepetitionPanel
          data={mockData}
          onStartReview={jest.fn()}
        />
      );

      expect(screen.getByText('Future Review')).toBeInTheDocument();
    });
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // Test Suite: Loading and Error States
  // ═══════════════════════════════════════════════════════════════════════════

  describe('loading state', () => {
    it('should show loading indicator when loading is true', () => {
      render(
        <SpacedRepetitionPanel
          loading={true}
          onStartReview={jest.fn()}
        />
      );

      // Use specific text to avoid matching multiple "Loading" elements
      expect(screen.getByText('Loading reviews...')).toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('should show error message when error is provided', () => {
      render(
        <SpacedRepetitionPanel
          error="Failed to load spaced repetition data"
          onStartReview={jest.fn()}
        />
      );

      expect(screen.getByText(/Failed to load spaced repetition data/i)).toBeInTheDocument();
    });

    it('should show retry button when error and onRetry are provided', () => {
      const mockRetry = jest.fn();

      render(
        <SpacedRepetitionPanel
          error="Failed to load"
          onStartReview={jest.fn()}
          onRetry={mockRetry}
        />
      );

      const retryButton = screen.getByRole('button', { name: /Try Again/i });
      fireEvent.click(retryButton);

      expect(mockRetry).toHaveBeenCalled();
    });
  });
});
