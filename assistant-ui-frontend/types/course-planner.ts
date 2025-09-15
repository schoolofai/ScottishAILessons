export interface SchedulingContextForCourse {
  student: {
    id: string;
    displayName?: string;
    accommodations?: string[];
  };
  course: {
    $id: string;
    courseId: string;
    subject: string;
    level: string;
  };
  sow: {
    entries: Array<{
      order: number;
      lessonTemplateId: string;
      plannedAt?: string;
    }>;
  };
  templates: Array<{
    $id: string;
    title: string;
    outcomeRefs: string[];
    estMinutes?: number;
    status: "published";
  }>;
  mastery?: {
    emaByOutcome: { [outcomeId: string]: number };
  };
  routine?: {
    dueAtByOutcome: { [outcomeId: string]: string };
    lastTaughtAt?: string;
    recentTemplateIds?: string[];
  };
  constraints?: {
    maxBlockMinutes?: number;
    avoidRepeatWithinDays?: number;
    preferOverdue?: boolean;
    preferLowEMA?: boolean;
  };
  graphRunId?: string;
}

export interface LessonCandidate {
  lessonTemplateId: string;
  title: string;
  targetOutcomeIds: string[];
  estimatedMinutes?: number;
  priorityScore: number;
  reasons: string[];
  flags?: string[];
}

export interface CourseRecommendation {
  courseId: string;
  generatedAt: string;
  graphRunId: string;
  candidates: LessonCandidate[];
  rubric: string;
}